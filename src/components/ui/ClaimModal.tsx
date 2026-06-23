'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSignMessage } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { useCheckUsername, useClaimProfile } from '@/hooks/useProfile'
import ChessAvatar from '@/components/ui/ChessAvatar'
import GlowButton from '@/components/ui/GlowButton'

function useProfileTotal() {
  return useQuery<number | null>({
    queryKey: ['profile-total'],
    queryFn: async () => {
      const res = await fetch('/api/profile/total')
      if (!res.ok) return null
      const data = await res.json() as { total: number }
      return data.total
    },
    staleTime: 60_000,
  })
}

interface ClaimModalProps {
  open: boolean
  address: string
  onClose: () => void
  onSuccess?: () => void
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  maxLength: number
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black tracking-[0.2em] uppercase text-[var(--t3)]">{label}</label>
        <span className="text-[9px] text-[var(--t3)]">{value.length}/{maxLength}</span>
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        placeholder={placeholder}
        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-[var(--t1)] placeholder:text-[var(--t3)] focus:outline-none focus:border-[var(--c)] transition-colors"
      />
      {hint && <p className="text-[9px] text-[var(--t3)] leading-relaxed">{hint}</p>}
    </div>
  )
}

export default function ClaimModal({ open, address, onClose, onSuccess }: ClaimModalProps) {
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [error, setError] = useState('')
  const { data: total } = useProfileTotal()

  const debouncedUsername = username.trim().toLowerCase()
  const { data: checkResult, isLoading: isChecking } = useCheckUsername(debouncedUsername)
  const { mutateAsync: claimProfile, isPending } = useClaimProfile()
  const { signMessageAsync } = useSignMessage()

  useEffect(() => {
    if (!open) {
      setStep('form')
      setUsername('')
      setDisplayName('')
      setBio('')
      setError('')
    }
  }, [open])

  const usernameStatus = (() => {
    if (debouncedUsername.length < 3) return null
    if (isChecking) return 'checking'
    if (!checkResult) return null
    return checkResult.available ? 'available' : checkResult.reason ?? 'taken'
  })()

  const canSubmit =
    debouncedUsername.length >= 3 &&
    displayName.trim().length >= 1 &&
    usernameStatus === 'available' &&
    !isPending

  const handleClaim = async () => {
    if (!canSubmit) return
    setError('')
    try {
      const timestamp = new Date().toISOString()
      const message = `Chessify Profile Claim\n\nUsername: ${debouncedUsername}.chess\nAddress: ${address}\nTimestamp: ${timestamp}`
      const signature = await signMessageAsync({ message })
      await claimProfile({
        address,
        username: debouncedUsername,
        displayName: displayName.trim(),
        bio: bio.trim(),
        signature,
        timestamp,
      })
      setStep('success')
      onSuccess?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="m-sheet-wrap fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 12 }}
            transition={{ type: 'spring', damping: 22, stiffness: 220 }}
            className="m-sheet w-full max-w-md rounded-[28px] border border-white/10"
            style={{ background: 'linear-gradient(145deg,rgba(0,204,255,0.06) 0%,rgba(6,6,15,0.98) 60%)' }}
          >
            {step === 'success' ? (
              <div className="p-10 flex flex-col items-center gap-6 text-center">
                <div className="text-5xl">✦</div>
                <div>
                  <p className="text-[10px] font-black tracking-[0.3em] uppercase text-[var(--c)] mb-2">Identity Claimed</p>
                  <h2 className="text-3xl font-black uppercase" style={{ fontFamily: 'var(--fd)' }}>
                    {debouncedUsername}<span style={{ color: 'var(--c)' }}>.chess</span>
                  </h2>
                  <p className="text-sm text-[var(--t3)] mt-3">Your on-chain identity is live.</p>
                </div>
                <GlowButton variant="brand" fullWidth parallelogram onClick={onClose}>DONE</GlowButton>
              </div>
            ) : (
              <div className="p-7 flex flex-col gap-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight" style={{ fontFamily: 'var(--fd)' }}>
                      Claim <span style={{ color: 'var(--c)' }}>.chess</span>
                    </h2>
                    <p className="text-[10px] text-[var(--t3)] mt-0.5">Your permanent on-chain identity</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-[var(--t3)] hover:text-white transition-colors text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5"
                  >×</button>
                </div>

                {/* OG hint — shown while slots remain */}
                {(total === null || total === undefined || total < 100) && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-amber-400/20 bg-amber-400/5">
                    <span className="text-amber-400 text-base leading-none">✦</span>
                    <div>
                      <p className="text-[10px] font-black tracking-[0.18em] uppercase text-amber-400">OG Status Available</p>
                      <p className="text-[9px] text-white/40 mt-0.5">
                        {total !== null && total !== undefined
                          ? `${100 - total} of 100 OG spots remaining — first 100 profiles get the ✦ badge forever.`
                          : 'First 100 profiles get the ✦ OG badge permanently.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Avatar preview */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-black/30 border border-white/5">
                  <ChessAvatar address={address} size={48} />
                  <div>
                    <p className="font-black text-base" style={{ fontFamily: 'var(--fd)' }}>
                      {debouncedUsername.length >= 3 ? (
                        <>{debouncedUsername}<span style={{ color: 'var(--c)' }}>.chess</span></>
                      ) : (
                        <span className="text-[var(--t3)]">username.chess</span>
                      )}
                    </p>
                    <p className="text-[10px] text-[var(--t3)] mt-0.5">{`${address.slice(0, 6)}…${address.slice(-4)}`}</p>
                  </div>
                </div>

                {/* Username */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black tracking-[0.2em] uppercase text-[var(--t3)]">USERNAME</label>
                    <span className="text-[9px] text-[var(--t3)]">{username.length}/20</span>
                  </div>
                  <div className="relative">
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20))}
                      placeholder="jadon"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-[var(--t1)] placeholder:text-[var(--t3)] focus:outline-none focus:border-[var(--c)] transition-colors pr-24"
                    />
                    <span
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black"
                      style={{ color: 'var(--c)' }}
                    >.chess</span>
                  </div>
                  {debouncedUsername.length >= 3 && (
                    <p className={`text-[9px] font-bold ${
                      usernameStatus === 'available' ? 'text-green-400' :
                      usernameStatus === 'checking' ? 'text-[var(--t3)]' : 'text-red-400'
                    }`}>
                      {usernameStatus === 'available' ? '✓ Available' :
                       usernameStatus === 'checking' ? 'Checking…' :
                       `✗ ${usernameStatus}`}
                    </p>
                  )}
                  <p className="text-[9px] text-[var(--t3)]">3–20 characters. Letters, numbers, hyphens only.</p>
                </div>

                <Field
                  label="DISPLAY NAME"
                  value={displayName}
                  onChange={setDisplayName}
                  placeholder="Jadon"
                  maxLength={30}
                  hint="Shown in game — can be anything."
                />

                <Field
                  label="BIO"
                  value={bio}
                  onChange={setBio}
                  placeholder="Nigerian chess player…"
                  maxLength={120}
                />

                {error && (
                  <p className="text-xs text-red-400 font-bold text-center">{error}</p>
                )}

                <div className="flex gap-3">
                  <GlowButton variant="ghost" fullWidth onClick={onClose}>CANCEL</GlowButton>
                  <GlowButton
                    variant="brand"
                    fullWidth
                    parallelogram
                    loading={isPending}
                    disabled={!canSubmit}
                    onClick={handleClaim}
                  >
                    SIGN & CLAIM
                  </GlowButton>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
