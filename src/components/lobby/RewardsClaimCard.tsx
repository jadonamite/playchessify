'use client'

// Weekly Grand Prix prize banner — shown to every connected player once a
// season has been seeded on-chain. Winners get their amount and a CLAIM
// button; everyone else gets the consolation line. Claimed state persists
// (on-chain) so returning winners see a quiet "claimed" chip, not a dead CTA.
//
// Clicking CLAIM never reveals eligibility on the banner itself — the answer
// only lands after a beat of "checking" (see useTournamentRewards). Only once
// a wallet is confirmed eligible does the "you're eligible" modal open, with
// its own two-step choice: claim to this wallet, or claim to another one.

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { isAddress } from 'viem'
import GlowButton from '@/components/ui/GlowButton'
import { useTournamentRewards } from '@/hooks/useTournamentRewards'

type ModalStep = 'closed' | 'eligible' | 'forward'

export default function RewardsClaimCard() {
  const { status, checkEligibility, claim, isClaiming } = useTournamentRewards()
  const [step, setStep] = useState<ModalStep>('closed')
  const [forwardTo, setForwardTo] = useState('')

  // No concluded season with a frozen prize board yet — nothing to show.
  if (!status) return null

  const { seasonId, prize, isWinner, claimed } = status
  const forwardValid = forwardTo.length > 0 && isAddress(forwardTo)

  const handleCheck = async () => {
    const eligible = await checkEligibility()
    if (eligible) setStep('eligible')
  }

  const closeModal = () => {
    setStep('closed')
    setForwardTo('')
  }

  const claimToSelf = async () => {
    await claim()
    closeModal()
  }

  const claimToAnother = async () => {
    if (!forwardValid) return
    await claim(forwardTo)
    closeModal()
  }

  return (
    <>
      <div className="w-full max-w-7xl mx-auto mb-6">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--gold,#f5c542)]/25 px-5 py-4"
          style={{ background: 'linear-gradient(90deg,rgba(245,197,66,0.08) 0%,rgba(6,6,15,0.7) 100%)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="shrink-0" style={{ color: '#f5c542' }}><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2ZM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8Zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1Z"/></svg>
            <div className="min-w-0">
              <p className="text-xs font-black tracking-wide text-white">
                Grand Prix <span style={{ color: '#f5c542' }}>S{seasonId}</span> has concluded
                {isWinner && claimed && <> — ${prize} claimed</>}
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
              disabled={isClaiming}
              onClick={() => void handleCheck()}
            >
              {isClaiming ? 'CHECKING…' : 'CLAIM'}
            </GlowButton>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {step !== 'closed' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="m-sheet-wrap fixed inset-0 z-[70] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
            onClick={(e) => { if (e.target === e.currentTarget && !isClaiming) closeModal() }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 12 }}
              transition={{ type: 'spring', damping: 22, stiffness: 220 }}
              className="m-sheet w-full max-w-md rounded-[28px] border border-white/10"
              style={{ background: 'linear-gradient(145deg,rgba(245,197,66,0.08) 0%,rgba(6,6,15,0.98) 60%)' }}
            >
              {step === 'eligible' ? (
                <div className="p-8 flex flex-col items-center gap-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2ZM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8Zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1Z"/></svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-black tracking-[0.3em] uppercase text-[#f5c542] mb-2">
                      Congratulations
                    </p>
                    <h2 className="text-2xl font-black uppercase" style={{ fontFamily: 'var(--fd)' }}>
                      You&apos;re eligible
                    </h2>
                    <p className="text-3xl font-black mt-3" style={{ fontFamily: 'var(--fd)', color: '#f5c542' }}>
                      ${prize}
                    </p>
                    <p className="text-xs text-[var(--t3)] mt-2">Choose where your prize lands.</p>
                  </div>
                  <div className="flex flex-col gap-3 w-full">
                    <GlowButton
                      variant="brand"
                      fullWidth
                      parallelogram
                      loading={isClaiming}
                      onClick={() => void claimToSelf()}
                    >
                      CLAIM TO MY WALLET
                    </GlowButton>
                    <GlowButton
                      variant="ghost"
                      fullWidth
                      disabled={isClaiming}
                      onClick={() => setStep('forward')}
                    >
                      CLAIM TO ANOTHER WALLET
                    </GlowButton>
                  </div>
                </div>
              ) : (
                <div className="p-7 flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-black uppercase tracking-tight" style={{ fontFamily: 'var(--fd)' }}>
                        Claim to <span style={{ color: '#f5c542' }}>another wallet</span>
                      </h2>
                      <p className="text-[10px] text-[var(--t3)] mt-0.5">
                        ${prize} lands in your wallet first, then forwards on.
                      </p>
                    </div>
                    <button
                      onClick={() => setStep('eligible')}
                      disabled={isClaiming}
                      className="text-[var(--t3)] hover:text-white transition-colors text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5"
                    >×</button>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black tracking-[0.2em] uppercase text-[var(--t3)]">
                      DESTINATION ADDRESS
                    </label>
                    <input
                      value={forwardTo}
                      onChange={(e) => setForwardTo(e.target.value.trim())}
                      placeholder="0x…"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-[var(--t1)] placeholder:text-[var(--t3)] focus:outline-none focus:border-[var(--c)] transition-colors"
                    />
                    {forwardTo.length > 0 && !forwardValid && (
                      <p className="text-[9px] font-bold text-red-400">Not a valid address.</p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <GlowButton variant="ghost" fullWidth disabled={isClaiming} onClick={() => setStep('eligible')}>
                      BACK
                    </GlowButton>
                    <GlowButton
                      variant="brand"
                      fullWidth
                      parallelogram
                      loading={isClaiming}
                      disabled={!forwardValid}
                      onClick={() => void claimToAnother()}
                    >
                      CONFIRM & CLAIM
                    </GlowButton>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
