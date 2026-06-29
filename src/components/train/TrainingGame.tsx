'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import TrainingBoard from '@/components/train/TrainingBoard'
import TrapButton from '@/components/train/TrapButton'
import { useAnalysis } from '@/hooks/useAnalysis'
import { useLearner } from '@/hooks/useLearner'
import { fetchCoachVoice } from '@/lib/coach/client'
import { getCoach, type CoachEngine } from '@/config/coaches'
import { getCoachMove } from '@/lib/chess-engine'
import { recognizeOpening } from '@/config/openings'
import type { Concept, LearnerLevel } from '@/types/training'

type Phase = 'learner' | 'analyzing' | 'intercept' | 'coach' | 'over'
type Mode = 'guided' | 'play'

// Light remarks the coach drops in Just-Play when nothing notable is happening.
const LIGHT_REMARKS = [
  'Keep developing — get your pieces into the game.',
  'Mind your king\'s safety; think about castling.',
  'Control the centre — it pays off later.',
  'Don\'t move the same piece twice for no reason.',
  'Look for your opponent\'s threats before your own plans.',
]

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

  const [mode, setMode] = useState<Mode>('guided')
  const [game, setGame] = useState(() => new Chess())
  const [phase, setPhase] = useState<Phase>('learner')
  const [note, setNote] = useState<string>('Make your move — I\'ll guide you.')
  const preFenRef = useRef<string>(new Chess().fen())
  const pendingRef = useRef<{ fen: string } | null>(null)
  const announcedOpeningRef = useRef<string | null>(null)
  const playMoveCountRef = useRef(0)
  // Diagnostic signal accumulated from THIS game's real moves; persisted once at
  // game end (one signature, not one per move) — "training on where they stop".
  const conceptDeltaRef = useRef<Partial<Record<Concept, number>>>({})
  const persistedRef = useRef(false)
  // Cached eval (white cp) of the position the learner is about to move from, so
  // the blunder check needs only ONE shallow search per move instead of two.
  const evalBeforeRef = useRef<number>(20)
  const liveRef = useRef(true) // false once the game is over — gates late async work

  const addConcept = useCallback((c: Concept, d: number) => {
    conceptDeltaRef.current[c] = (conceptDeltaRef.current[c] ?? 0) + d
  }, [])

  // Refresh the cached "before" eval in the background (non-blocking). Runs when
  // it becomes the learner's turn, so it's ready by the time they move.
  const refreshBeforeEval = useCallback(async (fen: string) => {
    const r = await analyze(fen, { movetime: 200 })
    if (r) evalBeforeRef.current = r.whiteCp
  }, [analyze])

  // Warm the engine + seed the opening eval once.
  useEffect(() => { void refreshBeforeEval(new Chess().fen()) }, [refreshBeforeEval])

  // Fold this game's signal into the learner model once, at game over.
  const endGame = useCallback((g: Chess) => {
    liveRef.current = false
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

  // Coach reply — INSTANT. The move is local (homegrown minimax); we yield one
  // frame so the learner's move paints first, then play. No network, no deep
  // search on this path — that's what made it slow.
  const coachReply = useCallback((afterFen: string) => {
    const g = new Chess(afterFen)
    if (g.isGameOver()) { endGame(g); return }
    setPhase('coach')
    setTimeout(() => {
      const move = getCoachMove(g, coachEngineForLevel(coach.engine, level))
      if (!move) { endGame(g); return }
      g.move(move)
      setGame(g)
      if (g.isGameOver()) { endGame(g); return }
      setNote('Your move.')
      setPhase('learner')
      void refreshBeforeEval(g.fen()) // background — ready for the next blunder check
    }, 50)
  }, [coach, level, endGame, refreshBeforeEval])

  // Just-Play reply: the coach is a spectator. It moves, names the opening when
  // one is reached, and otherwise drops the occasional principle — no analysis,
  // no interception, no take-back, no diagnostic.
  const coachReplyPlay = useCallback(async (afterFen: string) => {
    const g = new Chess(afterFen)
    if (g.isGameOver()) { endGame(g); return }
    setPhase('coach')
    await new Promise((r) => setTimeout(r, 60))
    const move = getCoachMove(g, coachEngineForLevel(coach.engine, level))
    if (!move) { endGame(g); return }
    g.move(move)
    setGame(g)
    if (g.isGameOver()) { endGame(g); return }

    const opening = recognizeOpening(g.history())
    playMoveCountRef.current += 1
    if (opening && opening.name !== announcedOpeningRef.current) {
      announcedOpeningRef.current = opening.name
      setNote(opening.note)
    } else if (playMoveCountRef.current % 5 === 0) {
      setNote(LIGHT_REMARKS[Math.floor(Math.random() * LIGHT_REMARKS.length)])
    } else {
      setNote('Your move.')
    }
    setPhase('learner')
  }, [coach, level, endGame])

  const onMove = useCallback((from: string, to: string): boolean => {
    if (phase !== 'learner') return false
    const preFen = game.fen()
    const probe = new Chess(preFen)
    const move = probe.move({ from, to, promotion: 'q' })
    if (!move) return false
    preFenRef.current = preFen // take-back target (before this move)
    liveRef.current = true
    setGame(probe)

    // Just-Play: skip all analysis/interception — coach just responds.
    if (mode === 'play') {
      setPhase('coach')
      void coachReplyPlay(probe.fen())
      return true
    }

    // GUIDED: coach replies immediately; the blunder check runs in the
    // background (one shallow search vs the cached "before" eval) and can offer
    // a take-back retroactively. Nothing blocks the coach's move.
    const movedFen = probe.fen()
    void coachReply(movedFen)

    void (async () => {
      const post = await analyze(movedFen, { movetime: 200 })
      if (!post || !liveRef.current) return
      const lossCp = evalBeforeRef.current - post.whiteCp // white; + = lost ground
      const alreadyLost = evalBeforeRef.current < -300

      if (lossCp >= BLUNDER_CP && !alreadyLost) {
        addConcept(lossCp >= 400 ? 'hanging-piece' : 'calculation', -0.05)
        pendingRef.current = { fen: movedFen }
        setNote('Hold on — that gives something away. Want it back?')
        setPhase('intercept')
        // Enrich asynchronously: name the better move + coach voice, then upgrade.
        void (async () => {
          const pre = await analyze(preFen, { movetime: 250 })
          const v = await fetchCoachVoice({
            coachName: coach.name, coachVoice: coach.teaching.voice, learnerLevel: level,
            kind: 'blunder', playerMoveSan: move.san, bestMoveSan: uciToSan(preFen, pre?.bestMove ?? null) ?? undefined,
            evalDeltaCp: lossCp, detail: 'that move gives ground', fen: preFen,
          })
          if (liveRef.current) setNote(v.text)
        })()
      } else if (lossCp <= 30) {
        addConcept('calculation', 0.02)
      }
    })()
    return true
  }, [phase, game, analyze, coach, level, coachReply, coachReplyPlay, mode, addConcept])

  // Revert to the position before the learner's move (undoes their move AND the
  // coach's reply), let them try again. The cached "before" eval still holds.
  const takeBack = useCallback(() => {
    setGame(new Chess(preFenRef.current))
    pendingRef.current = null
    liveRef.current = true
    setPhase('learner')
    setNote('Good call — let\'s find a better one.')
  }, [])

  // Keep the move: the coach has already replied, so just dismiss the warning.
  const playAnyway = useCallback(() => {
    pendingRef.current = null
    setPhase('learner')
    setNote('Alright — we play on.')
  }, [])

  const reset = useCallback((toMode?: Mode) => {
    const g = new Chess()
    const m = toMode ?? mode
    setGame(g)
    preFenRef.current = g.fen()
    pendingRef.current = null
    announcedOpeningRef.current = null
    playMoveCountRef.current = 0
    persistedRef.current = false
    conceptDeltaRef.current = {}
    liveRef.current = true
    evalBeforeRef.current = 20
    void refreshBeforeEval(g.fen())
    setPhase('learner')
    setNote(m === 'play' ? 'Just play — I\'ll watch and chime in.' : 'Make your move — I\'ll guide you.')
  }, [mode, refreshBeforeEval])

  const switchMode = useCallback((m: Mode) => {
    if (m === mode) return
    setMode(m)
    reset(m) // fresh board so guided/play state never mixes
  }, [mode, reset])

  const board = useMemo(() => (
    <TrainingBoard game={game} orientation="white"
      interactive={phase === 'learner'} onMove={onMove} />
  ), [game, phase, onMove])

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: coach.accent }}>
            Training · {coach.name}
          </div>
          <h1 className="font-bold text-xl text-white">{mode === 'play' ? 'Just play' : 'Guided game'}</h1>
        </div>
        <button onClick={() => reset()} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5">
          New game
        </button>
      </div>

      {/* Mode toggle — Guided (coach intercepts) vs Just Play (coach watches). */}
      <div className="mb-4 inline-flex rounded-xl border border-white/10 bg-white/5 p-1 text-sm">
        {(['guided', 'play'] as const).map((m) => (
          <button key={m} onClick={() => switchMode(m)}
            className="rounded-lg px-4 py-1.5 font-semibold transition"
            style={mode === m
              ? { background: coach.accent, color: '#04121a' }
              : { color: '#9fb2c8' }}>
            {m === 'guided' ? 'Guided' : 'Just play'}
          </button>
        ))}
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
          <div className="mt-3 flex items-stretch gap-2">
            <div className="flex-1">
              <TrapButton accent={coach.accent} onClick={takeBack} style={{ fontSize: 13, padding: '12px 20px' }}>
                Take it back
              </TrapButton>
            </div>
            <button onClick={playAnyway} className="flex-1 rounded-lg border border-white/15 py-2 text-slate-300 hover:bg-white/5">
              Play it anyway
            </button>
          </div>
        )}

        {phase === 'over' && (
          <div className="mt-3">
            <TrapButton accent={coach.accent} onClick={() => reset()} style={{ fontSize: 13, padding: '12px 20px' }}>
              Play again
            </TrapButton>
          </div>
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
