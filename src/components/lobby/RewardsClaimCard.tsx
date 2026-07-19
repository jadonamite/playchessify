'use client'

// Weekly Grand Prix prize banner — shown to every connected player once a
// season has been seeded on-chain. Winners get their amount and a CLAIM
// button; everyone else gets the consolation line. Claimed state persists
// (on-chain) so returning winners see a quiet "claimed" chip, not a dead CTA.

import { motion } from 'framer-motion'
import GlowButton from '@/components/ui/GlowButton'
import { useTournamentRewards } from '@/hooks/useTournamentRewards'

export default function RewardsClaimCard() {
  const { status, claim, isClaiming } = useTournamentRewards()

  // No concluded season with a frozen prize board yet — nothing to show.
  if (!status) return null

  const { seasonId, prize, isWinner, claimed } = status

  return (
    <div className="w-full max-w-7xl mx-auto mb-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--gold,#f5c542)]/25 px-5 py-4"
        style={{ background: 'linear-gradient(90deg,rgba(245,197,66,0.08) 0%,rgba(6,6,15,0.7) 100%)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg shrink-0">🏆</span>
          <div className="min-w-0">
            <p className="text-xs font-black tracking-wide text-white">
              Grand Prix <span style={{ color: '#f5c542' }}>S{seasonId}</span> rewards
              {isWinner && !claimed && <> — <span style={{ color: '#f5c542' }}>${prize}</span> is yours</>}
              {isWinner && claimed && <> — ${prize} claimed ✓</>}
            </p>
            <p className="text-[10px] text-[var(--t3)] truncate">
              {isWinner
                ? claimed
                  ? 'Paid out to your wallet. See you on next season’s podium.'
                  : 'You made the podium. Claim your USDm prize below.'
                : 'Sorry, you are not eligible — try again next season.'}
            </p>
          </div>
        </div>
        {isWinner && !claimed && (
          <GlowButton
            variant="brand"
            size="sm"
            parallelogram
            className="shrink-0"
            disabled={isClaiming}
            onClick={() => void claim()}
          >
            {isClaiming ? 'CLAIMING…' : 'CLAIM'}
          </GlowButton>
        )}
      </motion.div>
    </div>
  )
}
