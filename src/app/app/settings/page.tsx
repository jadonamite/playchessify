'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useSignMessage } from 'wagmi'
import { useWallet } from '@/components/wallet-provider'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { useSettingsStore, BOARD_THEMES, AI_DIFFICULTY_LABELS, PIECE_SETS, type BoardTheme, type AiDifficulty } from '@/hooks/useSettingsStore'
import { piecePath } from '@/lib/chessPieces'
import GlowButton from '@/components/ui/GlowButton'
import ClayCard from '@/components/ui/ClayCard'
import ChessAvatar from '@/components/ui/ChessAvatar'
import ClaimModal from '@/components/ui/ClaimModal'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-3"
    >
      <h2
        className="text-[10px] font-black tracking-[0.3em] uppercase"
        style={{ color: 'var(--t3)', fontFamily: 'var(--fd)' }}
      >{title}</h2>
      {children}
    </motion.div>
  )
}

function Toggle({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl bg-black/20 border border-white/5">
      <div>
        <p className="text-sm font-bold text-[var(--t1)]">{label}</p>
        {sub && <p className="text-[10px] text-[var(--t3)] mt-0.5">{sub}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative inline-flex items-center w-11 h-6 rounded-full p-0.5 border-0 box-border transition-colors shrink-0 cursor-pointer"
        style={{ background: checked ? 'var(--c)' : 'rgba(255,255,255,0.1)' }}
      >
        <span
          className="block w-5 h-5 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const { playerAddress, isConnected } = useWallet()
  const { soundEnabled, setSoundEnabled, boardTheme, setBoardTheme, pieceSet, setPieceSet, aiDifficulty, setAiDifficulty, showMoveHints, setShowMoveHints } = useSettingsStore()
  const { data: profile } = useProfile(playerAddress ?? null)
  const { mutateAsync: updateProfile, isPending: isUpdating } = useUpdateProfile()
  const { signMessageAsync } = useSignMessage()

  const [claimOpen, setClaimOpen] = useState(false)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editDirty, setEditDirty] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSaved, setEditSaved] = useState(false)

  // Sync fields when profile loads
  useEffect(() => {
    if (profile && !editDirty) {
      setEditDisplayName(profile.displayName ?? '')
      setEditBio(profile.bio ?? '')
    }
  }, [profile, editDirty])

  const handleSaveProfile = async () => {
    if (!playerAddress || !profile) return
    setEditError('')
    try {
      const timestamp = new Date().toISOString()
      const message = `Chessify Profile Update\n\nAddress: ${playerAddress}\nTimestamp: ${timestamp}`
      const signature = await signMessageAsync({ message })
      await updateProfile({ address: playerAddress, displayName: editDisplayName.trim(), bio: editBio.trim(), signature, timestamp })
      setEditDirty(false)
      setEditSaved(true)
      setTimeout(() => setEditSaved(false), 3000)
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Update failed')
    }
  }

  const BOARD_THEME_KEYS = Object.keys(BOARD_THEMES) as BoardTheme[]
  const AI_DIFFICULTIES: AiDifficulty[] = ['easy', 'medium', 'hard']

  return (
    <main className="min-h-screen w-full bg-[var(--bg)] text-[var(--t1)] relative overflow-x-hidden">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[8%] right-[10%] w-[28%] h-[28%] bg-[var(--c)] blur-[150px] rounded-full opacity-[0.045]" />
        <div className="absolute bottom-[12%] left-[6%] w-[22%] h-[22%] bg-[#6a0dad] blur-[130px] rounded-full opacity-[0.035]" />
      </div>
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-40"
        style={{
          backgroundImage: 'linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />

      <div className="relative z-10 max-w-2xl mx-auto px-4 md:px-8 py-12 md:py-24">
        <div className="flex items-center justify-between mb-10">
          <div>
            <GlowButton variant="ghost" size="sm" onClick={() => router.push('/app/lobby')} className="mb-4">
              ← LOBBY
            </GlowButton>
            <h1 className="text-4xl font-black uppercase tracking-tight" style={{ fontFamily: 'var(--fd)', textShadow: 'var(--hero-text-shadow)' }}>
              SETTINGS
            </h1>
          </div>
        </div>

        <div className="flex flex-col gap-10">

          {/* ── SOUND ── */}
          <Section title="Sound">
            <ClayCard className="p-0 overflow-hidden">
              <Toggle
                label="Sound Effects"
                sub="Move sounds and ambient music during game"
                checked={soundEnabled}
                onChange={setSoundEnabled}
              />
            </ClayCard>
          </Section>

          {/* ── GAMEPLAY ── */}
          <Section title="Gameplay">
            <ClayCard className="p-5 flex flex-col gap-5">
              {/* AI difficulty */}
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-sm font-bold text-[var(--t1)]">AI Difficulty</p>
                  <p className="text-[10px] text-[var(--t3)] mt-0.5">Strength of the bot in single-player training</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {AI_DIFFICULTIES.map((key) => {
                    const isActive = aiDifficulty === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setAiDifficulty(key)}
                        className="py-2.5 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-colors"
                        style={{
                          borderColor: isActive ? 'var(--c)' : 'rgba(255,255,255,0.07)',
                          background: isActive ? 'rgba(0,204,255,0.06)' : 'rgba(0,0,0,0.2)',
                          color: isActive ? 'var(--c)' : 'var(--t2)',
                        }}
                      >
                        {AI_DIFFICULTY_LABELS[key]}
                      </button>
                    )
                  })}
                </div>
              </div>
            </ClayCard>
            <ClayCard className="p-0 overflow-hidden">
              <Toggle
                label="Move Hints"
                sub="Highlight legal destinations when you pick up a piece"
                checked={showMoveHints}
                onChange={setShowMoveHints}
              />
            </ClayCard>
          </Section>

          {/* ── BOARD ── */}
          <Section title="Board Theme">
            <ClayCard className="p-5">
              <div className="grid grid-cols-2 gap-3">
                {BOARD_THEME_KEYS.map((key) => {
                  const theme = BOARD_THEMES[key]
                  const isActive = boardTheme === key
                  return (
                    <button
                      key={key}
                      onClick={() => setBoardTheme(key)}
                      className="flex flex-col gap-2 p-3 rounded-2xl border transition-colors text-left"
                      style={{
                        borderColor: isActive ? 'var(--c)' : 'rgba(255,255,255,0.07)',
                        background: isActive ? 'rgba(0,204,255,0.06)' : 'rgba(0,0,0,0.2)',
                      }}
                    >
                      {/* Mini board preview */}
                      <div className="grid grid-cols-4 rounded-lg overflow-hidden w-full aspect-square max-w-[80px]">
                        {Array.from({ length: 16 }).map((_, i) => (
                          <div
                            key={i}
                            style={{
                              background: (Math.floor(i / 4) + i) % 2 === 0 ? theme.light : theme.dark,
                            }}
                          />
                        ))}
                      </div>
                      <span
                        className="text-[10px] font-black tracking-wide"
                        style={{ color: isActive ? 'var(--c)' : 'var(--t2)' }}
                      >{theme.name}</span>
                    </button>
                  )
                })}
              </div>
            </ClayCard>
          </Section>

          {/* ── PIECE SET ── */}
          <Section title="Piece Set">
            <ClayCard className="p-5">
              <div className="grid grid-cols-2 gap-3">
                {PIECE_SETS.map((set) => {
                  const isActive = pieceSet === set.id
                  return (
                    <button
                      key={set.id}
                      type="button"
                      onClick={() => setPieceSet(set.id)}
                      className="flex flex-col gap-2 p-3 rounded-2xl border transition-colors text-left"
                      style={{
                        borderColor: isActive ? 'var(--c)' : 'rgba(255,255,255,0.07)',
                        background: isActive ? 'rgba(0,204,255,0.06)' : 'rgba(0,0,0,0.2)',
                      }}
                    >
                      <div
                        className="flex items-center justify-center gap-1 rounded-lg p-2"
                        style={{ background: 'rgba(255,255,255,0.06)' }}
                      >
                        {['wN', 'bQ', 'wK'].map((code) => (
                          // eslint-disable-next-line @next/next/no-img-element -- dynamic SVG piece sprite, next/image unsuitable
                          <img
                            key={code}
                            src={piecePath(set.id, code)}
                            alt={code}
                            draggable={false}
                            className="w-8 h-8"
                          />
                        ))}
                      </div>
                      <span
                        className="text-[10px] font-black tracking-wide"
                        style={{ color: isActive ? 'var(--c)' : 'var(--t2)' }}
                      >{set.name}</span>
                    </button>
                  )
                })}
              </div>
            </ClayCard>
          </Section>

          {/* ── PROFILE ── */}
          <Section title="Profile">
            {!isConnected ? (
              <ClayCard className="p-6 text-center">
                <p className="text-sm text-[var(--t3)]">Connect your wallet to manage your profile.</p>
              </ClayCard>
            ) : !profile ? (
              <ClayCard className="p-6 flex flex-col items-center gap-4">
                <p className="text-sm text-[var(--t2)] text-center">You don&apos;t have a <span style={{ color: 'var(--c)' }}>.chess</span> identity yet.</p>
                <GlowButton variant="brand" parallelogram onClick={() => setClaimOpen(true)}>
                  CLAIM .CHESS NAME
                </GlowButton>
              </ClayCard>
            ) : (
              <ClayCard className="p-6 flex flex-col gap-5">
                {/* Profile header */}
                <div className="flex items-center gap-4">
                  {playerAddress && <ChessAvatar address={playerAddress} size={48} />}
                  <div>
                    <p className="font-black text-lg" style={{ fontFamily: 'var(--fd)' }}>
                      {profile.username}<span style={{ color: 'var(--c)' }}>.chess</span>
                      {profile.og && (
                        <span className="ml-2 text-[#fbbf24] text-sm">✦</span>
                      )}
                    </p>
                    <p className="text-[10px] text-[var(--t3)]">{playerAddress?.slice(0, 8)}…{playerAddress?.slice(-6)}</p>
                  </div>
                </div>

                {/* Edit fields */}
                <div className="flex flex-col gap-4 border-t border-white/5 pt-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between">
                      <label className="text-[10px] font-black tracking-[0.2em] uppercase text-[var(--t3)]">DISPLAY NAME</label>
                      <span className="text-[9px] text-[var(--t3)]">{editDisplayName.length}/30</span>
                    </div>
                    <input
                      value={editDisplayName}
                      onChange={(e) => { setEditDisplayName(e.target.value.slice(0, 30)); setEditDirty(true); setEditSaved(false) }}
                      placeholder={profile.displayName || 'Your name'}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-[var(--t1)] placeholder:text-[var(--t3)] focus:outline-none focus:border-[var(--c)] transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between">
                      <label className="text-[10px] font-black tracking-[0.2em] uppercase text-[var(--t3)]">BIO</label>
                      <span className="text-[9px] text-[var(--t3)]">{editBio.length}/120</span>
                    </div>
                    <textarea
                      value={editBio}
                      onChange={(e) => { setEditBio(e.target.value.slice(0, 120)); setEditDirty(true); setEditSaved(false) }}
                      placeholder={profile.bio || 'Tell the board about yourself'}
                      rows={3}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-[var(--t1)] placeholder:text-[var(--t3)] focus:outline-none focus:border-[var(--c)] transition-colors resize-none"
                    />
                  </div>

                  {editError && <p className="text-xs text-red-400 font-bold">{editError}</p>}
                  {editSaved && <p className="text-xs text-green-400 font-bold">✓ Saved</p>}

                  <GlowButton
                    variant="brand"
                    fullWidth
                    parallelogram
                    loading={isUpdating}
                    disabled={!editDirty}
                    onClick={handleSaveProfile}
                  >
                    SAVE CHANGES
                  </GlowButton>

                  <GlowButton
                    variant="ghost"
                    fullWidth
                    onClick={() => router.push(`/app/profile/${playerAddress}`)}
                  >
                    VIEW FULL PROFILE →
                  </GlowButton>
                </div>
              </ClayCard>
            )}
          </Section>

        </div>
      </div>

      {playerAddress && (
        <ClaimModal
          open={claimOpen}
          address={playerAddress}
          onClose={() => setClaimOpen(false)}
          onSuccess={() => setClaimOpen(false)}
        />
      )}
    </main>
  )
}
