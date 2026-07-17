'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import TrainingBoard from '@/components/train/TrainingBoard'
import TrapButton from '@/components/train/TrapButton'
import { useAnalysis } from '@/hooks/useAnalysis'
import { useLearner } from '@/hooks/useLearner'
import { useRecordStreak } from '@/hooks/useStreak'
import { useSettingsStore } from '@/hooks/useSettingsStore'
import { playMoveChime } from '@/lib/audio'
import { fetchCoachVoice } from '@/lib/coach/client'
import { coachingComment, taunt, banter } from '@/lib/coach/lines'
import { getCoach, type CoachEngine } from '@/config/coaches'
import { getCoachMove } from '@/lib/chess-engine'
import { recognizeOpening } from '@/config/openings'
import type { Concept, LearnerLevel } from '@/types/training'

type Phase = 'learner' | 'thinking' | 'intercept' | 'over'
type Mode = 'guided' | 'match'

const BLUNDER_CP = 150
const THINK_MS = 450 // coach "thinking" beat — masks the blunder analysis

function coachEngineForLevel(base: CoachEngine, level: LearnerLevel): CoachEngine {
  if (level === 'basics') return { ...base, depth: 1, topK: 4, temperature: 0.6 }
  if (level === 'intermediate') return { ...base, depth: 2, topK: 3, temperature: 0.4 }
  return base
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Persist the coach game so it survives a reload (bot games do the same via their
// own key). Only stable learner-to-move positions are saved (see the persist
// effect), so a restore never lands the board on the coach's turn and stalls.
const TRAIN_SAVE_KEY = 'chess:train:save'

function loadSavedFen(): string {
  const fresh = new Chess().fen()
  if (typeof window === 'undefined') return fresh
  try {
    const raw = localStorage.getItem(TRAIN_SAVE_KEY)
    if (!raw) return fresh
    const parsed = JSON.parse(raw) as { fen?: unknown }
    if (typeof parsed.fen === 'string') {
      new Chess(parsed.fen) // validates — throws on a corrupt fen
      return parsed.fen
    }
  } catch { /* corrupt / blocked — start fresh */ }
  return fresh
}

export default function TrainingGame() {
  const { analyze } = useAnalysis()
  const { learner, update } = useLearner()
  const recordStreak = useRecordStreak()
  const soundEnabled = useSettingsStore((s) => s.soundEnabled)
  const coach = getCoach(learner?.coachId)
  const level = learner?.level ?? 'basics'

  const [mode, setMode] = useState<Mode>('guided')
  const [game, setGame] = useState(() => new Chess(loadSavedFen()))
  const [phase, setPhase] = useState<Phase>('learner')
  const [note, setNote] = useState<string>('Make your move — I\'ll guide you.')

  const preFenRef = useRef<string>(loadSavedFen())
  // A practice session counts toward the daily play streak (source 'puzzle'),
  // recorded once on the learner's first move. Idempotent per UTC day server-side.
  const streakDoneRef = useRef(false)
  const pendingRef = useRef<string | null>(null) // learner's move fen, awaiting play-anyway
  const announcedOpeningRef = useRef<string | null>(null)
  const evalBeforeRef = useRef<number>(20)
  const liveRef = useRef(true)
  const conceptDeltaRef = useRef<Partial<Record<Concept, number>>>({})
  const persistedRef = useRef(false)
  const audioRef = useRef<AudioContext | null>(null)

  // ── sound ──────────────────────────────────────────────────────────────────
  const playChime = useCallback((opponent: boolean) => {
    if (!soundEnabled) return
    try {
      if (!audioRef.current) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        audioRef.current = new AC()
      }
      if (audioRef.current.state === 'suspended') void audioRef.current.resume()
      playMoveChime(audioRef.current, opponent)
    } catch { /* audio unavailable */ }
  }, [soundEnabled])

  // Read the mode chosen on the hub (?mode=guided|match) once on mount.
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get('mode')
    if (m === 'match' || m === 'guided') {
      setMode(m)
      setNote(m === 'match' ? taunt(coach.id) : 'Make your move — I\'ll guide you.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshBeforeEval = useCallback(async (fen: string) => {
    const r = await analyze(fen, { movetime: 200 })
    if (r) evalBeforeRef.current = r.whiteCp
  }, [analyze])

  useEffect(() => { void refreshBeforeEval(preFenRef.current) }, [refreshBeforeEval])

  // Persist the board so a reload resumes the same coach game. Only save when it's
  // the learner's turn (white) and the game is live — never a coach-to-move or
  // finished position, so a restore always resumes on a playable move.
  useEffect(() => {
    try {
      if (phase === 'over' || game.isGameOver()) { localStorage.removeItem(TRAIN_SAVE_KEY); return }
      if (game.turn() === 'w') localStorage.setItem(TRAIN_SAVE_KEY, JSON.stringify({ fen: game.fen() }))
    } catch { /* storage blocked / quota */ }
  }, [game, phase])

  const moveNumber = (g: Chess) => Math.ceil(g.history().length / 2)

  const endGame = useCallback((g: Chess) => {
    liveRef.current = false
    setPhase('over')
    setNote(resultText(g, mode))
    if (persistedRef.current || !learner || mode !== 'guided') return
    persistedRef.current = true
    const concepts: Partial<Record<Concept, number>> = {}
    for (const [c, d] of Object.entries(conceptDeltaRef.current)) {
      const cur = learner.concepts[c as Concept] ?? 0
      concepts[c as Concept] = Math.max(0, Math.min(1, cur + (d as number)))
    }
    if (Object.keys(concepts).length > 0) void update({ concepts }).catch(() => {})
  }, [learner, update, mode, coach.id])

  // Coach plays its own move (local, fast). Shared by both modes.
  const coachMove = useCallback((fromFen: string, after: () => void) => {
    const g = new Chess(fromFen)
    const engine = mode === 'match' ? coach.engine : coachEngineForLevel(coach.engine, level)
    const move = getCoachMove(g, engine)
    if (!move) { endGame(g); return }
    g.move(move)
    setGame(g)
    playChime(true)
    preFenRef.current = g.fen()
    if (g.isGameOver()) { endGame(g); return }
    after()
    void refreshBeforeEval(g.fen())
  }, [mode, coach.engine, level, endGame, playChime, refreshBeforeEval])

  // ── guided: coach reply after the think beat ─────────────────────────────────
  const guidedReply = useCallback((movedFen: string) => {
    coachMove(movedFen, () => {
      setNote('Your move — I\'m watching.')
      setPhase('learner')
    })
  }, [coachMove])

  const onMove = useCallback((from: string, to: string): boolean => {
    if (phase !== 'learner') return false
    const preFen = game.fen()
    const probe = new Chess(preFen)
    const move = probe.move({ from, to, promotion: 'q' })
    if (!move) return false
    preFenRef.current = preFen
    liveRef.current = true
    setGame(probe)
    playChime(false)
    // First move of the session counts the day toward the play streak.
    if (!streakDoneRef.current) { streakDoneRef.current = true; void recordStreak('puzzle') }
    const movedFen = probe.fen()

    if (probe.isGameOver()) { endGame(probe); return true }

    if (mode === 'match') {
      // Full match — no coaching, just a worthy opponent + occasional banter.
      setPhase('thinking')
      void (async () => {
        await delay(THINK_MS + 150)
        if (!liveRef.current) return
        coachMove(movedFen, () => {
          const op = recognizeOpening(new Chess(preFenRef.current).history())
          if (op && op.name !== announcedOpeningRef.current) { announcedOpeningRef.current = op.name; setNote(op.note) }
          else if (moveNumber(probe) % 4 === 0) setNote(banter(moveNumber(probe)))
          else setNote('Your move.')
          setPhase('learner')
        })
      })()
      return true
    }

    // GUIDED — react to YOUR move instantly, then think (masking the analysis).
    setNote(coachingComment(move, probe, moveNumber(probe), coach.teaching.specialty))
    setPhase('thinking')
    void (async () => {
      const [post] = await Promise.all([analyze(movedFen, { movetime: 200 }), delay(THINK_MS)])
      if (!liveRef.current) return
      const lossCp = post ? evalBeforeRef.current - post.whiteCp : 0
      const alreadyLost = evalBeforeRef.current < -300

      if (post && lossCp >= BLUNDER_CP && !alreadyLost) {
        conceptDeltaRef.current[lossCp >= 400 ? 'hanging-piece' : 'calculation'] =
          (conceptDeltaRef.current[lossCp >= 400 ? 'hanging-piece' : 'calculation'] ?? 0) - 0.05
        pendingRef.current = movedFen
        setNote('Hold on — that gives something away. Want it back?')
        setPhase('intercept')
        // Enrich asynchronously with a named better move + coach voice.
        void (async () => {
          const pre = await analyze(preFen, { movetime: 250 })
          const v = await fetchCoachVoice({
            coachName: coach.name, coachVoice: coach.teaching.voice, learnerLevel: level,
            kind: 'blunder', playerMoveSan: move.san, bestMoveSan: uciToSan(preFen, pre?.bestMove ?? null) ?? undefined,
            evalDeltaCp: lossCp, detail: 'that move gives ground', fen: preFen,
          })
          if (liveRef.current && pendingRef.current === movedFen) setNote(v.text)
        })()
        return
      }
      if (post && lossCp <= 30) conceptDeltaRef.current.calculation = (conceptDeltaRef.current.calculation ?? 0) + 0.02
      guidedReply(movedFen)
    })()
    return true
  }, [phase, game, mode, analyze, coach, level, coachMove, guidedReply, endGame, playChime, recordStreak])

  const takeBack = useCallback(() => {
    setGame(new Chess(preFenRef.current))
    pendingRef.current = null
    liveRef.current = true
    setPhase('learner')
    setNote('Good call — let\'s find a better one.')
  }, [])

  const playAnyway = useCallback(() => {
    const fen = pendingRef.current
    pendingRef.current = null
    if (!fen) { setPhase('learner'); return }
    setPhase('thinking')
    guidedReply(fen)
  }, [guidedReply])

  const reset = useCallback((toMode?: Mode) => {
    const g = new Chess()
    const m = toMode ?? mode
    setGame(g)
    preFenRef.current = g.fen()
    pendingRef.current = null
    announcedOpeningRef.current = null
    evalBeforeRef.current = 20
    liveRef.current = true
    persistedRef.current = false
    streakDoneRef.current = false
    conceptDeltaRef.current = {}
    try { localStorage.removeItem(TRAIN_SAVE_KEY) } catch { /* ignore */ }
    void refreshBeforeEval(g.fen())
    setPhase('learner')
    setNote(m === 'match' ? taunt(coach.id) : 'Make your move — I\'ll guide you.')
  }, [mode, refreshBeforeEval, coach.id])

  const switchMode = useCallback((m: Mode) => {
    if (m === mode) return
    setMode(m)
    reset(m)
  }, [mode, reset])

  const board = useMemo(() => (
    <TrainingBoard game={game} orientation="white" interactive={phase === 'learner'} onMove={onMove} />
  ), [game, phase, onMove])

  const thinking = phase === 'thinking'

  return (
    <div className="flex w-full flex-col items-center pb-8">
      {/* ── Coach, ON TOP (the opponent across the table) ── */}
      <div className="w-full max-w-[600px] px-4 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1 text-sm">
            {(['guided', 'match'] as const).map((m) => (
              <button key={m} onClick={() => switchMode(m)}
                className="rounded-lg px-3.5 py-1.5 font-semibold transition"
                style={mode === m ? { background: coach.accent, color: '#04121a' } : { color: '#9fb2c8' }}>
                {m === 'guided' ? 'Coach me' : 'Challenge'}
              </button>
            ))}
          </div>
          <button onClick={() => reset()} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5">
            New game
          </button>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border p-3"
             style={{ borderColor: phase === 'intercept' ? '#fb718566' : coach.accent + '40', background: `linear-gradient(160deg, ${coach.accent}10, rgba(9,15,30,0.5))` }}>
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2" style={{ borderColor: coach.accent }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={encodeURI(coach.img)} alt={coach.name} className="h-full w-full object-cover object-top" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">{coach.name}</span>
              <span className="text-[11px] uppercase tracking-wide" style={{ color: coach.accent }}>{mode === 'match' ? 'opponent' : 'coach'}</span>
            </div>
            <p className="mt-0.5 text-[15px] leading-snug text-slate-200">
              {thinking ? <span className="text-slate-400">{coach.name} is thinking…</span> : note}
            </p>
          </div>
        </div>
      </div>

      {/* ── Board, full-width (matches the real game board) ── */}
      <div className="pc-board-wrap mt-3">{board}</div>

      {/* ── Your controls, below ── */}
      <div className="w-full max-w-[600px] px-4">
        {phase === 'intercept' && (
          <div className="mt-4 flex items-stretch gap-2">
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
          <div className="mt-4">
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

function resultText(g: Chess, mode: Mode): string {
  if (g.isCheckmate()) {
    const loser = g.turn() === 'w' ? 'white' : 'black'
    if (loser === 'white') {
      return mode === 'match'
        ? 'Checkmate. Told you. Run it back?'
        : 'Checkmate — they got you this time. Let\'s go again.'
    }
    return mode === 'match' ? `You beat me? Not bad at all. Again?` : 'Checkmate — beautifully done!'
  }
  if (g.isDraw() || g.isStalemate()) return 'A draw. Solid play — go again?'
  return 'Game over.'
}
