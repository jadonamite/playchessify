'use client'

// Weekly Grand Prix prize banner — shown to every connected player once a
// season has been seeded on-chain. Winners get their amount and a CLAIM
// button; everyone else gets the consolation line. Claimed state persists
// (on-chain) so returning winners see a quiet "claimed" chip, not a dead CTA.

import { useState } from 'react'
import { motion } from 'framer-motion'
import { isAddress } from 'viem'
import GlowButton from '@/components/ui/GlowButton'
import { useTournamentRewards } from '@/hooks/useTournamentRewards'

export default function RewardsClaimCard() {
  const { status, claim, isClaiming } = useTournamentRewards()
  const [showForward, setShowForward] = useState(false)
  const [forwardTo, setForwardTo] = useState('')

  // No concluded season with a frozen prize board yet — nothing to show.
  if (!status) return null

  const { seasonId, prize, isWinner, claimed } = status
  const forwardValid = forwardTo.length === 0 || isAddress(forwardTo)

  return (
    <div className="w-full max-w-7xl mx-auto mb-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 rounded-2xl border border-[var(--gold,#f5c542)]/25 px-5 py-4"
        style={{ background: 'linear-gradient(90deg,rgba(245,197,66,0.08) 0%,rgba(6,6,15,0.7) 100%)' }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-lg shrink-0">🏆</span>
            <div className="min-w-0">
              <p className="text-xs font-black tracking-wide text-white">
                Grand Prix <span style={{ color: '#f5c542' }}>S{seasonId}</span> has concluded
                {isWinner && claimed && <> — ${prize} claimed ✓</>}
              </p>
              <p className="text-[10px] text-[var(--t3)] truncate">
                {isWinner && claimed
                  ? 'Paid out to your wallet. See you on next season’s podium.'
                  : 'Prizes are live. Tap CLAIM to check your podium finish.'}
              </p>
            </div>
          </div>
          {!(isWinner && claimed) && (
            <GlowButton
              variant="brand"
              size="sm"
              parallelogram
              className="shrink-0"
              disabled={isClaiming || !forwardValid}
              onClick={() => void claim(forwardTo || undefined)}
            >
              {isClaiming ? 'CHECKING…' : 'CLAIM'}
            </GlowButton>
          )}
        </div>

        {!(isWinner && claimed) && (
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setShowForward((v) => !v)}
              className="self-start text-[9px] font-bold tracking-wide uppercase text-[var(--t3)] hover:text-[var(--c)] transition-colors"
            >
              {showForward ? '▾' : '▸'} Send to a different address
            </button>
            {showForward && (
              <div className="flex flex-col gap-1">
                <input
                  value={forwardTo}
                  onChange={(e) => setForwardTo(e.target.value.trim())}
                  placeholder="0x… (leave blank to claim to your own wallet)"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-[var(--t1)] placeholder:text-[var(--t3)] focus:outline-none focus:border-[var(--c)] transition-colors"
                />
                {!forwardValid && (
                  <p className="text-[9px] font-bold text-red-400">Not a valid address.</p>
                )}
                {forwardValid && forwardTo.length > 0 && (
                  <p className="text-[9px] text-[var(--t3)]">
                    Claims to your wallet first, then forwards ${prize} on to this address in a second transaction.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}
