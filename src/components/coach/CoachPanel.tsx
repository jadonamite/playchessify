'use client'

import { useEffect, useRef } from 'react'
import { useCoachAsk } from '@/hooks/useCoachAsk'
import type { CoachProfile } from '@/config/coaches'

/**
 * The coach at your shoulder. One component for every board in the app —
 * training, bot games, wagered games — so the coach is the same presence
 * everywhere rather than a training-only feature.
 *
 * Two layers, and the split is the product:
 *   the REACTION is free, instant and local, and is written to leave you
 *   wanting a second opinion;
 *   the ASK is metered, served from the server, and is the second opinion.
 */

interface CoachPanelProps {
  coach: CoachProfile
  /** The free reaction to the move just played. */
  note: string
  /** The coach is choosing its own move. */
  thinking?: boolean
  /** 'celo:<gameId>' or 'train:<id>'. Null disables asking entirely. */
  gameKey: string | null
  /** Position to ask about. */
  fen: string
  lastMoveSan?: string
  learnerLevel?: string
  /** 'coach' in training, 'opponent' when it is playing you. */
  role?: string
  /** Hide the ask control (game over, not your turn, spectating). */
  canAsk?: boolean
}

export default function CoachPanel({
  coach,
  note,
  thinking = false,
  gameKey,
  fen,
  lastMoveSan,
  learnerLevel = 'basics',
  role = 'coach',
  canAsk = true,
}: CoachPanelProps) {
  const { remaining, limit, asking, answer, error, ask, dismiss, clearOnPositionChange } = useCoachAsk(gameKey)

  // Drop the previous answer as soon as the board moves on. Advice about a
  // position you have left is worse than no advice, because it still looks
  // authoritative. The ref keeps the first render from clearing a fresh answer.
  const seenFen = useRef(fen)
  useEffect(() => {
    if (seenFen.current === fen) return
    seenFen.current = fen
    clearOnPositionChange()
  }, [fen, clearOnPositionChange])

  const outOfAsks = remaining !== null && remaining <= 0
  const askDisabled = !gameKey || !canAsk || asking || outOfAsks

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border p-3"
      style={{
        borderColor: answer ? `${coach.accent}80` : `${coach.accent}40`,
        background: `linear-gradient(160deg, ${coach.accent}10, rgba(9,15,30,0.5))`,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2"
          style={{ borderColor: coach.accent }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={encodeURI(coach.img)} alt={coach.name} className="h-full w-full object-cover object-top" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">{coach.name}</span>
            <span className="text-[11px] uppercase tracking-wide" style={{ color: coach.accent }}>{role}</span>
          </div>

          <p className="mt-0.5 text-[15px] leading-snug text-slate-200">{note}</p>

          {thinking && (
            <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full animate-pulse" style={{ background: coach.accent }} />
              {coach.name} is thinking…
            </span>
          )}
        </div>
      </div>

      {/* The answer you spent an ask on. Kept visually distinct from the free
          reaction so the difference between the two is obvious. */}
      {answer && (
        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
          <p className="text-[15px] leading-snug text-white">{answer.text}</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            {/* NOT uppercased. Chess notation is case sensitive — B is a bishop
                and b is the b-file — so text-transform turns Nxe4 into NXE4 and
                destroys the very thing the parentheses are there to teach. */}
            <span className="text-[11px] text-slate-400">
              <span className="uppercase tracking-wider text-slate-500">Engine line</span>
              {' '}
              {answer.bestMovePhrase ?? answer.bestMoveSan ?? 'consulted'}
            </span>
            <button onClick={dismiss} className="text-[10px] uppercase tracking-wider text-slate-400 hover:text-slate-200">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-[12px] font-semibold text-red-400">{error}</p>}

      {gameKey && canAsk && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={askDisabled}
            onClick={() => void ask({ fen, coachId: coach.id, learnerLevel, lastMoveSan })}
            className="rounded-xl px-4 py-2 text-[12px] font-black uppercase tracking-wider transition-colors disabled:cursor-not-allowed"
            style={{
              background: askDisabled ? 'rgba(255,255,255,0.05)' : `${coach.accent}1f`,
              color: askDisabled ? '#64748b' : coach.accent,
              boxShadow: askDisabled ? 'none' : `inset 0 0 0 1.5px ${coach.accent}55`,
            }}
          >
            {asking ? 'Asking…' : outOfAsks ? 'No questions left' : `Ask ${coach.short}`}
          </button>

          <span className="text-[11px] tabular-nums text-slate-400">
            {remaining === null ? `${limit} questions` : `${remaining} of ${limit} left`}
          </span>
        </div>
      )}
    </div>
  )
}
