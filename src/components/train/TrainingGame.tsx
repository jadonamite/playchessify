'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import TrainingBoard from '@/components/train/TrainingBoard'
import { useAnalysis } from '@/hooks/useAnalysis'
import { useLearner } from '@/hooks/useLearner'
import { fetchCoachVoice } from '@/lib/coach/client'
import { getCoach, type CoachEngine } from '@/config/coaches'
import { getCoachMove } from '@/lib/chess-engine'
import type { Concept, LearnerLevel } from '@/types/training'

type Phase = 'learner' | 'analyzing' | 'intercept' | 'coach' | 'over'

// A move that drops at least this many centipawns (vs the best move) is flagged
// for interception — unless the learner was already clearly lost.
const BLUNDER_CP = 150

/** Soften the coach to the learner's level + a notch (zone of proximal dev). */
function coachEngineForLevel(base: CoachEngine, level: LearnerLevel): CoachEngine {
  if (level === 'basics') return { ...base, depth: 1, topK: 4, temperature: 0.6 }
  if (level === 'intermediate') return { ...base, depth: 2, topK: 3, temperature: 0.4 }
  return base
}

export default function TrainingGame() {
  const { analyze, ready } = useAnalysis()
  const { learner, update } = useLearner()
  const coach = getCoach(learner?.coachId)
  const level = learner?.level ?? 'basics'

  const [game, setGame] = useState(() => new Chess())
  const [phase, setPhase] = useState<Phase>('learner')
  const [note, setNote] = useState<string>('Make your move — I\'ll guide you.')
  const preFenRef = useRef<string>(new Chess().fen())
  const pendingRef = useRef<{ fen: string } | null>(null)
  // Diagnostic signal accumulated from THIS game's real moves; persisted once at
  // game end (one signature, not one per move) — "training on where they stop".
  const conceptDeltaRef = useRef<Partial<Record<Concept, number>>>({})
  const persistedRef = useRef(false)

  const addConcept = useCallback((c: Concept, d: number) => {
    conceptDeltaRef.current[c] = (conceptDeltaRef.current[c] ?? 0) + d
  }, [])

  // Fold this game's signal into the learner model once, at game over.
  const endGame = useCallback((g: Chess) => {
    setPhase('over')
    setNote(resultText(g, 'white'))
    if (persistedRef.current || !learner) return
    persistedRef.current = true
    const deltas = conceptDeltaRef.current
    const concepts: Partial<Record<Concept, number>> = {}
    for (const [c, d] of Object.entries(deltas)) {
      const cur = learner.concepts[c as Concept] ?? 0
      concepts[c as Concept] = Math.max(0, Math.min(1, cur + (d as number)))
    }
    if (Object.keys(concepts).length > 0) void update({ concepts }).catch(() => {})
  }, [learner, update])

  const coachReply = useCallback(async (afterFen: string) => {
    const g = new Chess(afterFen)
    if (g.isGameOver()) { endGame(g); return }
    setPhase('coach')
    // Homegrown style-biased move (synchronous); brief delay so it feels human.
    await new Promise((r) => setTimeout(r, 350))
    const move = getCoachMove(g, coachEngineForLevel(coach.engine, level))
    if (!move) { endGame(g); return }
    g.move(move)
    setGame(g)
    preFenRef.current = g.fen()
    if (g.isGameOver()) { endGame(g); return }
    const v = await fetchCoachVoice({
      coachName: coach.name, coachVoice: coach.teaching.voice, learnerLevel: level,
      kind: 'coach-move', playerMoveSan: move.san, fen: afterFen,
    })
    setNote(v.text)
    setPhase('learner')
  }, [coach, level, endGame])

  const onMove = useCallback((from: string, to: string): boolean => {
    if (phase !== 'learner') return false
    const preFen = game.fen()
    const probe = new Chess(preFen)
    const move = probe.move({ from, to, promotion: 'q' })
    if (!move) return false
    preFenRef.current = preFen
    pendingRef.current = { fen: probe.fen() }
    setGame(probe)
    setPhase('analyzing')
    setNote('Let me look at that…')

    void (async () => {
      const pre = await analyze(preFen, { depth: 12 })
      const post = await analyze(probe.fen(), { depth: 12 })
      if (!pre || !post) { void coachReply(probe.fen()); return } // engine down → just continue
      const lossCp = pre.whiteCp - post.whiteCp // learner is White; positive = lost ground
      const alreadyLost = pre.whiteCp < -300

      if (lossCp >= BLUNDER_CP && !alreadyLost) {
        // A big one-move drop is usually a hung piece; a smaller one, calculation.
        addConcept(lossCp >= 400 ? 'hanging-piece' : 'calculation', -0.05)
        const bestSan = uciToSan(preFen, pre.bestMove)
        const v = await fetchCoachVoice({
          coachName: coach.name, coachVoice: coach.teaching.voice, learnerLevel: level,
          kind: 'blunder', playerMoveSan: move.san, bestMoveSan: bestSan ?? undefined,
          evalDeltaCp: lossCp, detail: 'that move gives ground', fen: preFen,
        })
        setNote(v.text)
        setPhase('intercept')
        return
      }
      // Decent move — light reinforcement, then the coach replies.
      if (lossCp <= 30) { setNote('Good — that holds up.'); addConcept('calculation', 0.02) }
      void coachReply(probe.fen())
    })()
    return true
  }, [phase, game, analyze, coach, level, coachReply, addConcept])

  const takeBack = useCallback(() => {
    setGame(new Chess(preFenRef.current))
    pendingRef.current = null
    setPhase('learner')
    setNote('Good call — let\'s find a better one.')
  }, [])

  const playAnyway = useCallback(() => {
    const fen = pendingRef.current?.fen
    if (!fen) return
    void coachReply(fen)
  }, [coachReply])

  const reset = useCallback(() => {
    const g = new Chess()
    setGame(g)
    preFenRef.current = g.fen()
    pendingRef.current = null
    setPhase('learner')
    setNote('New game — make your move.')
  }, [])

  const board = useMemo(() => (
    <TrainingBoard game={game} orientation="white"
      interactive={phase === 'learner'} onMove={onMove} />
  ), [game, phase, onMove])

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: coach.accent }}>
            Training · {coach.name}
          </div>
          <h1 className="font-bold text-xl text-white">Guided game</h1>
        </div>
        <button onClick={reset} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5">
          New game
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0a1220]/80 p-3">{board}</div>

      <div className="mt-4 min-h-[92px] rounded-xl border p-4"
           style={{ borderColor: phase === 'intercept' ? '#fb718566' : coach.accent + '33' }}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-full border" style={{ borderColor: coach.accent }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={encodeURI(coach.img)} alt={coach.name} className="h-full w-full object-cover object-top" />
          </div>
          <p className="text-[15px] leading-relaxed text-slate-200">
            {note}{!ready && phase === 'learner' && <span className="ml-2 text-xs text-slate-500">(engine warming…)</span>}
          </p>
        </div>

        {phase === 'intercept' && (
          <div className="mt-3 flex gap-2">
            <button onClick={takeBack} className="flex-1 rounded-lg py-2 font-bold text-[#04121a]" style={{ backgroundColor: coach.accent }}>
              Take it back
            </button>
            <button onClick={playAnyway} className="flex-1 rounded-lg border border-white/15 py-2 text-slate-300 hover:bg-white/5">
              Play it anyway
            </button>
          </div>
        )}

        {phase === 'over' && (
          <button onClick={reset} className="mt-3 w-full rounded-lg py-2 font-bold text-[#04121a]" style={{ backgroundColor: coach.accent }}>
            Play again
          </button>
        )}
      </div>
    </div>
  )
}

function uciToSan(fen: string, uci: string | null): string | null {
  if (!uci) return null
  try {
    const g = new Chess(fen)
    const m = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: (uci[4] as 'q' | 'r' | 'b' | 'n') || 'q' })
    return m?.san ?? null
  } catch { return null }
}

function resultText(g: Chess, learnerColor: 'white' | 'black'): string {
  if (g.isCheckmate()) {
    const loser = g.turn() === 'w' ? 'white' : 'black'
    return loser === learnerColor ? 'Checkmate — they got you this time. Let\'s go again.' : 'Checkmate — beautifully done!'
  }
  if (g.isDraw() || g.isStalemate()) return 'A draw. Solid defending — play again?'
  return 'Game over.'
}
