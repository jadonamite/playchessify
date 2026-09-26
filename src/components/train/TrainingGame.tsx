'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess, type Move } from 'chess.js'
import TrainingBoard from '@/components/train/TrainingBoard'
import TrapButton from '@/components/train/TrapButton'
import { useAnalysis } from '@/hooks/useAnalysis'
import { useLearner } from '@/hooks/useLearner'
import { useRecordStreak } from '@/hooks/useStreak'
import { useSettingsStore } from '@/hooks/useSettingsStore'
import { playMoveChime } from '@/lib/audio'
import { fetchCoachVoice } from '@/lib/coach/client'
import { taunt, banter } from '@/lib/coach/lines'
import { coachReaction } from '@/lib/coach/reactions'
import { describeMove } from '@/lib/chess-language'
import CoachPanel from '@/components/coach/CoachPanel'
import { getCoach, type CoachEngine } from '@/config/coaches'
import { getCoachMove } from '@/lib/chess-engine'
import { recognizeOpening } from '@/config/openings'
import type { Concept, LearnerLevel } from '@/types/training'

type Phase = 'learner' | 'thinking' | 'intercept' | 'over'
type Mode = 'guided' | 'match'

const BLUNDER_CP = 150
/** Above this you are winning comfortably enough that a dip is not worth an
 *  interruption — the lesson lands better when you are actually in trouble. */
const WINNING_CP = 300
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
//
// Saved as PGN, not FEN. A FEN is a position with no past, and this component
// leans on the move list for the move number, opening recognition and banter —
// all of which silently degrade to "move 1, no opening" when the history is gone.
const TRAIN_SAVE_KEY = 'chess:train:save'

/** Copy a game WITH its move list. `new Chess(g.fen())` throws the history away. */
function cloneWithHistory(g: Chess): Chess {
  const c = new Chess()
  try {
    c.loadPgn(g.pgn())
  } catch {
    // A position reached some other way is better than no position at all.
    c.load(g.fen())
  }
  return c
}

function loadSavedGame(): Chess {
  if (typeof window === 'undefined') return new Chess()
  try {
    const raw = localStorage.getItem(TRAIN_SAVE_KEY)
    if (!raw) return new Chess()
    const parsed = JSON.parse(raw) as { pgn?: unknown; fen?: unknown }
    if (typeof parsed.pgn === 'string') {
      const g = new Chess()
      g.loadPgn(parsed.pgn) // throws on a corrupt pgn
      return g
    }
    // Saves written before this component persisted PGN. The position is
    // recoverable, the history is not — honour the board, accept the blank past.
    if (typeof parsed.fen === 'string') {
      const g = new Chess()
      g.load(parsed.fen)
      return g
    }
  } catch { /* corrupt / blocked — start fresh */ }
  return new Chess()
}

export default function TrainingGame() {
  const { analyze } = useAnalysis()
  const { learner, update } = useLearner()
  const recordStreak = useRecordStreak()
  const soundEnabled = useSettingsStore((s) => s.soundEnabled)
  const coach = getCoach(learner?.coachId)
  const level = learner?.level ?? 'basics'

  // The meter is per game, so a practice board needs an id of its own. Minted
  // once per game and re-minted on reset, which is what makes "ten per game"
  // mean the same thing here as it does in a real game.
  const [gameKey, setGameKey] = useState(() => `train:${Math.random().toString(36).slice(2, 12)}`)
  const [lastMoveSan, setLastMoveSan] = useState<string | undefined>(undefined)

  const [mode, setMode] = useState<Mode>('guided')
  const [game, setGame] = useState(loadSavedGame)
  const [phase, setPhase] = useState<Phase>('learner')
  const [note, setNote] = useState<string>('Make your move — I\'ll guide you.')

  // The position before the learner's pending move — a game object, so taking a
  // move back restores the history along with the board.
  const preGameRef = useRef<Chess>(game)
  // A practice session counts toward the daily play streak (source 'puzzle'),
  // recorded once on the learner's first move. Idempotent per UTC day server-side.
  const streakDoneRef = useRef(false)
  const pendingRef = useRef<string | null>(null) // learner's move fen, awaiting play-anyway
  const pendingGameRef = useRef<Chess | null>(null) // the same move, with its history
  const announcedOpeningRef = useRef<string | null>(null)
  const evalBeforeRef = useRef<number>(20)
  const liveRef = useRef(true)
  const conceptDeltaRef = useRef<Partial<Record<Concept, number>>>({})
  const persistedRef = useRef(false)
  const audioRef = useRef<AudioContext | null>(null)

  // Blunders per starting position. A first slip at a position gets a gentle
  // nudge; a SECOND slip at the same position stops hinting and teaches — why the
  // move fails and the concrete move to play instead (highlighted on the board).
  const attemptRef = useRef<Record<string, number>>({})
  const [suggested, setSuggested] = useState<{ from: string; to: string } | null>(null)

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

  useEffect(() => { void refreshBeforeEval(preGameRef.current.fen()) }, [refreshBeforeEval])

  // Persist the board so a reload resumes the same coach game. Only save when it's
  // the learner's turn (white) and the game is live — never a coach-to-move or
  // finished position, so a restore always resumes on a playable move.
  useEffect(() => {
    try {
      if (phase === 'over' || game.isGameOver()) { localStorage.removeItem(TRAIN_SAVE_KEY); return }
      if (game.turn() === 'w') localStorage.setItem(TRAIN_SAVE_KEY, JSON.stringify({ pgn: game.pgn() }))
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
  }, [learner, update, mode])

  // Coach plays its own move (local, fast). Shared by both modes.
  // Takes and returns a game carrying its move list — `after` needs it to name
  // the opening and to know what move number we are on.
  const coachMove = useCallback((from: Chess, after: (g: Chess) => void) => {
    const g = cloneWithHistory(from)
    const engine = mode === 'match' ? coach.engine : coachEngineForLevel(coach.engine, level)
    const move = getCoachMove(g, engine)
    if (!move) { endGame(g); return }
    g.move(move)
    setGame(g)
    playChime(true)
    preGameRef.current = g
    if (g.isGameOver()) { endGame(g); return }
    after(g)
    void refreshBeforeEval(g.fen())
  }, [mode, coach.engine, level, endGame, playChime, refreshBeforeEval])

  // ── guided: coach reply after the think beat ─────────────────────────────────
  const guidedReply = useCallback((moved: Chess) => {
    coachMove(moved, () => {
      // Leaves the note alone: the reaction to your move should still be on
      // screen while you pick your next one.
      setPhase('learner')
    })
  }, [coachMove])

  const onMove = useCallback((from: string, to: string): boolean => {
    if (phase !== 'learner') return false
    const preFen = game.fen()
    const probe = cloneWithHistory(game)
    // chess.js v1 throws on an illegal move rather than returning null.
    let move: Move | null = null
    try {
      move = probe.move({ from, to, promotion: 'q' })
    } catch {
      return false
    }
    if (!move) return false
    preGameRef.current = game
    setLastMoveSan(move.san)
    setSuggested(null) // clear any "play this instead" highlight once they retry
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
        coachMove(probe, (g) => {
          // g.history() is the real move list. Reading it off a FEN gave [] on
          // every move, so no opening was ever recognised and banter never fired.
          const op = recognizeOpening(g.history())
          if (op && op.name !== announcedOpeningRef.current) { announcedOpeningRef.current = op.name; setNote(op.note) }
          else if (moveNumber(g) % 5 === 0) setNote(banter(moveNumber(g)))
          else setNote(coachReaction(coach, move, probe, moveNumber(probe)))
          setPhase('learner')
        })
      })()
      return true
    }

    // GUIDED — react to YOUR move instantly, then think (masking the analysis).
    setNote(coachReaction(coach, move, probe, moveNumber(probe)))
    setPhase('thinking')
    void (async () => {
      const [post] = await Promise.all([analyze(movedFen, { movetime: 200 }), delay(THINK_MS)])
      if (!liveRef.current) return
      const lossCp = post ? evalBeforeRef.current - post.whiteCp : 0
      const alreadyLost = evalBeforeRef.current < -300
      // Not a blunder while still plainly winning — the coach's own move can
      // swing the eval, and 1. e4 e5 2. Nf3 was being flagged.
      const stillWinning = !!post && post.whiteCp > WINNING_CP

      if (post && lossCp >= BLUNDER_CP && !alreadyLost && !stillWinning) {
        conceptDeltaRef.current[lossCp >= 400 ? 'hanging-piece' : 'calculation'] =
          (conceptDeltaRef.current[lossCp >= 400 ? 'hanging-piece' : 'calculation'] ?? 0) - 0.05
        pendingRef.current = movedFen
        pendingGameRef.current = probe
        setPhase('intercept')

        const attempts = (attemptRef.current[preFen] ?? 0) + 1
        attemptRef.current[preFen] = attempts

        // First slip → nudge only; let them find the fix themselves.
        if (attempts < 2) {
          setSuggested(null)
          setNote('Hold on — that gives something away. Take it back and look for a safer move.')
          return
        }

        // Second slip at the same spot → TEACH: why it fails + what to play, and
        // highlight that move on the board. The engine names the move (never the
        // LLM); the deterministic floor below always fires, then the coach voice
        // enriches the phrasing if a provider is available.
        setNote('You\'ve hit this twice — let me show you why.')
        void (async () => {
          const pre = await analyze(preFen, { movetime: 300 })
          const bestSan = uciToSan(preFen, pre?.bestMove ?? null)
          if (pre?.bestMove) {
            setSuggested({ from: pre.bestMove.slice(0, 2), to: pre.bestMove.slice(2, 4) })
          }
          const why = lossCp >= 400 ? 'it leaves a piece undefended' : 'it hands back the advantage'
          const floor = bestSan
            ? `Twice now — ${why}. Take it back and play ${describeMove(bestSan)} instead (highlighted).`
            : `Twice now — ${why}. Take it back and look for a safer square.`
          if (liveRef.current && pendingRef.current === movedFen) setNote(floor)
          const v = await fetchCoachVoice({
            coachName: coach.name, coachVoice: coach.teaching.voice, learnerLevel: level,
            kind: 'blunder', playerMoveSan: move.san, bestMoveSan: bestSan ?? undefined,
            evalDeltaCp: lossCp, concept: lossCp >= 400 ? 'a hanging piece' : 'a tactical slip',
            detail: 'the student just made this same mistake twice — explain plainly why it fails and what to play instead',
            fen: preFen,
          })
          if (liveRef.current && pendingRef.current === movedFen) setNote(v.text)
        })()
        return
      }
      if (post && lossCp <= 30) conceptDeltaRef.current.calculation = (conceptDeltaRef.current.calculation ?? 0) + 0.02
      guidedReply(probe)
    })()
    return true
  }, [phase, game, mode, analyze, coach, level, coachMove, guidedReply, endGame, playChime, recordStreak])

  const takeBack = useCallback(() => {
    // Restore the game object, not a FEN rebuilt from it: a take-back that wiped
    // the move list reset the coach to "move 1" for the rest of the session.
    setGame(cloneWithHistory(preGameRef.current))
    pendingRef.current = null
    pendingGameRef.current = null
    liveRef.current = true
    setPhase('learner')
    setNote('Good call — let\'s find a better one.')
  }, [])

  const playAnyway = useCallback(() => {
    const moved = pendingGameRef.current
    pendingRef.current = null
    pendingGameRef.current = null
    setSuggested(null)
    if (!moved) { setPhase('learner'); return }
    setPhase('thinking')
    guidedReply(moved)
  }, [guidedReply])

  const reset = useCallback((toMode?: Mode) => {
    const g = new Chess()
    const m = toMode ?? mode
    setGame(g)
    preGameRef.current = g
    pendingRef.current = null
    pendingGameRef.current = null
    announcedOpeningRef.current = null
    evalBeforeRef.current = 20
    liveRef.current = true
    persistedRef.current = false
    streakDoneRef.current = false
    conceptDeltaRef.current = {}
    attemptRef.current = {}
    setSuggested(null)
    setLastMoveSan(undefined)
    setGameKey(`train:${Math.random().toString(36).slice(2, 12)}`)
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

  const highlights = useMemo(
    () =>
      suggested
        ? {
            [suggested.from]: { backgroundColor: 'rgba(251,191,36,0.45)' },
            [suggested.to]: { background: 'radial-gradient(circle, rgba(251,191,36,0.7) 30%, transparent 32%)' },
          }
        : {},
    [suggested],
  )

  const board = useMemo(() => (
    <TrainingBoard game={game} orientation="white" interactive={phase === 'learner'} onMove={onMove} highlights={highlights} />
  ), [game, phase, onMove, highlights])

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

        <CoachPanel
          coach={coach}
          note={note}
          thinking={thinking}
          gameKey={gameKey}
          fen={game.fen()}
          lastMoveSan={lastMoveSan}
          learnerLevel={level}
          role={mode === 'match' ? 'opponent' : 'coach'}
          canAsk={phase !== 'over'}
        />
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
