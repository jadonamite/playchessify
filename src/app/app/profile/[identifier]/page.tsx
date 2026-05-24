'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useReadContract } from 'wagmi'
import { useWallet } from '@/components/wallet-provider'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { useSignMessage } from 'wagmi'
import { Navbar } from '@/components/landing/Hero'
import GlowButton from '@/components/ui/GlowButton'
import ClayCard from '@/components/ui/ClayCard'
import ChessAvatar from '@/components/ui/ChessAvatar'
import LoadingState from '@/components/ui/LoadingState'
import ClaimModal from '@/components/ui/ClaimModal'
import { CHESS_GAME_ABI } from '@/config/abis'
import { CELO_CONTRACTS } from '@/config/contracts'
import type { ChessProfile } from '@/types/profile'

function StatBox({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-2xl bg-black/30 border border-white/5 min-w-[80px]">
      <span className="text-[8px] font-black tracking-[0.25em] uppercase text-[var(--t3)]">{label}</span>
      <span
        className="text-xl font-black leading-none"
        style={{ fontFamily: 'var(--fd)', color: accent ? 'var(--c)' : 'var(--t1)' }}
      >{value}</span>
    </div>
  )
}

function EditField({
  label, value, onChange, maxLength, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; maxLength: number; placeholder: string }) {
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
        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-[var(--t1)] placeholder:text-[var(--t3)] focus:outline-none focus:border-[var(--c)] transition-colors"
      />
    </div>
  )
}

export default function ProfilePage() {
  const params = useParams()
  const router = useRouter()
  const identifier = decodeURIComponent(params.identifier as string)
  const { address: myAddress } = useWallet()
  const { signMessageAsync } = useSignMessage()
  const { mutateAsync: updateProfile, isPending: isUpdating } = useUpdateProfile()

  const [editing, setEditing] = useState(false)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editError, setEditError] = useState('')
  const [claimOpen, setClaimOpen] = useState(false)

  // Resolve profile — address or username
  const isAddress = identifier.startsWith('0x')

  const { data: profileByAddress, isLoading: loadingByAddr } = useProfile(isAddress ? identifier : null)

  const { data: profileByName, isLoading: loadingByName } = useQuery({
    queryKey: ['profile-name', identifier.toLowerCase()],
    queryFn: async (): Promise<ChessProfile | null> => {
      const res = await fetch(`/api/profile/name/${identifier.toLowerCase()}`)
      if (res.status === 404) return null
      if (!res.ok) return null
      const data = await res.json()
      return data.profile ?? null
    },
    enabled: !isAddress && identifier.length >= 3,
    staleTime: 5 * 60 * 1000,
  })

  const profile: ChessProfile | null | undefined = isAddress ? profileByAddress : profileByName
  const profileAddress = profile?.address ?? (isAddress ? identifier : null)
  const isLoading = isAddress ? loadingByAddr : loadingByName
  const isOwn = !!myAddress && !!profileAddress &&
    myAddress.toLowerCase() === profileAddress.toLowerCase()

  // On-chain stats
  const { data: stats } = useReadContract({
    address: CELO_CONTRACTS.game as `0x${string}`,
    abi: CHESS_GAME_ABI,
    functionName: 'playerStats',
    args: profileAddress ? [profileAddress as `0x${string}`] : undefined,
    query: { enabled: !!profileAddress },
  })

  const wins = stats ? Number((stats as any)[0]) : 0
  const losses = stats ? Number((stats as any)[1]) : 0
  const draws = stats ? Number((stats as any)[2]) : 0
  const rating = stats ? Number((stats as any)[3]) : 0
  const gamesPlayed = stats ? Number((stats as any)[4]) : 0
  const winRate = gamesPlayed > 0 ? `${Math.round((wins / gamesPlayed) * 100)}%` : '—'

  const startEdit = () => {
    setEditDisplayName(profile?.displayName ?? '')
    setEditBio(profile?.bio ?? '')
    setEditError('')
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!myAddress || !profile) return
    setEditError('')
    try {
      const timestamp = new Date().toISOString()
      const message = `Chessify Profile Update\n\nAddress: ${myAddress}\nTimestamp: ${timestamp}`
      const signature = await signMessageAsync({ message })
      await updateProfile({
        address: myAddress,
        displayName: editDisplayName.trim(),
        bio: editBio.trim(),
        signature,
        timestamp,
      })
      setEditing(false)
    } catch (e: any) {
      setEditError(e?.message ?? 'Update failed')
    }
  }

  const joinedDate = profile
    ? new Date(profile.createdAt).toLocaleDateString('en', { month: 'long', year: 'numeric' })
    : null

  return (
    <main className="min-h-screen w-full bg-[var(--bg)] text-[var(--t1)] relative overflow-x-hidden">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[10%] right-[10%] w-[30%] h-[30%] bg-[var(--c)] blur-[150px] rounded-full opacity-[0.05]" />
        <div className="absolute bottom-[15%] left-[8%] w-[25%] h-[25%] bg-[#6a0dad] blur-[130px] rounded-full opacity-[0.04]" />
      </div>
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-40"
        style={{
          backgroundImage: 'linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />

      <Navbar />

      <div className="relative z-10 max-w-2xl mx-auto px-4 md:px-8 py-12 md:py-24">
        <GlowButton variant="ghost" size="sm" onClick={() => router.back()} className="mb-8">
          ← BACK
        </GlowButton>

        {isLoading ? (
          <LoadingState message="LOADING PROFILE" />
        ) : !profile && !isAddress ? (
          <div className="text-center py-32">
            <p className="text-2xl font-black uppercase text-[var(--t3)]" style={{ fontFamily: 'var(--fd)' }}>
              Not found
            </p>
            <p className="text-sm text-[var(--t3)] mt-2">{identifier}.chess hasn&apos;t been claimed yet.</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6"
          >
            {/* Profile hero card */}
            <ClayCard className="p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="relative shrink-0">
                  <ChessAvatar address={profileAddress ?? identifier} size={80} />
                  {profile?.og && (
                    <span
                      className="absolute -top-1 -right-1 text-base"
                      title="OG — first 100 players"
                    >✦</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {profile ? (
                    <>
                      <h1 className="text-3xl font-black uppercase tracking-tight" style={{ fontFamily: 'var(--fd)' }}>
                        {profile.displayName || profile.username}
                      </h1>
                      <p className="text-[var(--c)] font-bold text-sm mt-0.5">
                        {profile.username}.chess
                        {profile.og && (
                          <span className="ml-2 text-[9px] font-black tracking-[0.2em] text-[#fbbf24] uppercase">OG</span>
                        )}
                      </p>
                      {profile.bio && (
                        <p className="text-sm text-[var(--t3)] mt-2 leading-relaxed">{profile.bio}</p>
                      )}
                      {joinedDate && (
                        <p className="text-[9px] text-[var(--t3)] mt-2 uppercase tracking-widest font-bold">
                          Member since {joinedDate}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <h1 className="text-2xl font-black uppercase tracking-tight text-[var(--t3)]" style={{ fontFamily: 'var(--fd)' }}>
                        {`${identifier.slice(0, 8)}…${identifier.slice(-6)}`}
                      </h1>
                      <p className="text-sm text-[var(--t3)] mt-1">No .chess name claimed</p>
                      {isOwn && (
                        <GlowButton
                          variant="brand"
                          size="sm"
                          parallelogram
                          className="mt-3"
                          onClick={() => setClaimOpen(true)}
                        >
                          CLAIM .CHESS NAME
                        </GlowButton>
                      )}
                    </>
                  )}
                </div>

                {profile && isOwn && !editing && (
                  <GlowButton variant="ghost" size="sm" onClick={startEdit}>EDIT</GlowButton>
                )}
              </div>

              {/* Edit form */}
              {editing && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 flex flex-col gap-4 border-t border-white/5 pt-6"
                >
                  <EditField
                    label="DISPLAY NAME"
                    value={editDisplayName}
                    onChange={setEditDisplayName}
                    maxLength={30}
                    placeholder="Your name"
                  />
                  <EditField
                    label="BIO"
                    value={editBio}
                    onChange={setEditBio}
                    maxLength={120}
                    placeholder="Tell the board about yourself"
                  />
                  {editError && <p className="text-xs text-red-400 font-bold">{editError}</p>}
                  <div className="flex gap-3">
                    <GlowButton variant="ghost" fullWidth onClick={() => setEditing(false)}>CANCEL</GlowButton>
                    <GlowButton variant="brand" fullWidth parallelogram loading={isUpdating} onClick={saveEdit}>
                      SAVE
                    </GlowButton>
                  </div>
                </motion.div>
              )}
            </ClayCard>

            {/* On-chain stats */}
            <ClayCard className="p-6">
              <p className="text-[10px] font-black tracking-[0.25em] uppercase text-[var(--t3)] mb-4">
                On-Chain Record
              </p>
              <div className="flex flex-wrap gap-3">
                <StatBox label="ELO" value={rating || '—'} accent />
                <StatBox label="WIN%" value={winRate} />
                <StatBox label="WINS" value={wins} />
                <StatBox label="LOSSES" value={losses} />
                <StatBox label="DRAWS" value={draws} />
                <StatBox label="PLAYED" value={gamesPlayed} />
              </div>
            </ClayCard>

            {/* Address */}
            {profileAddress && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-black/20 border border-white/5">
                <span className="text-[9px] font-black tracking-[0.2em] uppercase text-[var(--t3)]">ADDRESS</span>
                <span className="text-xs font-mono text-[var(--t2)] break-all flex-1">{profileAddress}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(profileAddress)}
                  className="text-[9px] font-black tracking-widest uppercase text-[var(--t3)] hover:text-[var(--c)] transition-colors shrink-0"
                >
                  COPY
                </button>
              </div>
            )}

            {/* Actions */}
            {!isOwn && profileAddress && (
              <div className="flex gap-3">
                <GlowButton
                  variant="brand"
                  fullWidth
                  parallelogram
                  onClick={() => router.push('/app/lobby')}
                >
                  CHALLENGE
                </GlowButton>
                <GlowButton
                  variant="ghost"
                  fullWidth
                  onClick={() => {
                    const url = `${window.location.origin}/app/profile/${profile?.username ?? profileAddress}`
                    navigator.clipboard.writeText(url)
                  }}
                >
                  SHARE PROFILE
                </GlowButton>
              </div>
            )}

            {isOwn && (
              <GlowButton
                variant="ghost"
                fullWidth
                onClick={() => {
                  const url = `${window.location.origin}/app/profile/${profile?.username ?? profileAddress}`
                  navigator.clipboard.writeText(url)
                }}
              >
                SHARE PROFILE
              </GlowButton>
            )}
          </motion.div>
        )}
      </div>

      {isOwn && myAddress && (
        <ClaimModal
          open={claimOpen}
          address={myAddress}
          onClose={() => setClaimOpen(false)}
          onSuccess={() => setClaimOpen(false)}
        />
      )}
    </main>
  )
}
