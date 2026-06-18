'use client'

import { motion } from 'framer-motion'
import type { ChessProfile } from '@/types/profile'
import GlowButton from '@/components/ui/GlowButton'
import ChessAvatar from '@/components/ui/ChessAvatar'
import ChessName from '@/components/ui/ChessName'
import { useToastStore } from '@/hooks/useToastStore'

type Color = 'white' | 'black'

interface WaitingRoomProps {
  gameId: number
  /** Total pot (both wagers), already formatted to a whole number. */
  pot: string
  myAddress: string
  myColor: Color
  profileMap: Record<string, ChessProfile | null>
  onLeave: () => void
}

const colorOf = (c: Color) => (c === 'white' ? 'var(--c)' : 'var(--candy-grape)')

export default function WaitingRoom({ gameId, pot, myAddress, myColor, profileMap, onLeave }: WaitingRoomProps) {
  const showToast = useToastStore((s) => s.showToast)
  const accent = colorOf(myColor)

  const copyId = () => {
    navigator.clipboard.writeText(String(gameId))
    showToast('Match ID copied!', 'info')
  }

  const share = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: 'Chess match', text: `Join my match #${gameId} on playchessify`, url }) } catch { /* dismissed */ }
    } else {
      navigator.clipboard.writeText(url)
      showToast('Match link copied!', 'info')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[55] flex items-center justify-center px-5 overflow-y-auto bg-[var(--bg)]"
    >
      {/* grid backdrop */}
      <div
        className="absolute inset-0 pointer-events-none z-0 opacity-40"
        style={{ backgroundImage: 'linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px)', backgroundSize: '52px 52px' }}
      />

      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-6 py-10">

        {/* radar pulse + avatar */}
        <div className="relative flex items-center justify-center" style={{ width: 132, height: 132 }}>
          {[0, 0.6, 1.2].map((delay) => (
            <motion.span
              key={delay}
              className="absolute rounded-full"
              style={{ width: 132, height: 132, border: `1.5px solid ${accent}` }}
              initial={{ scale: 0.45, opacity: 0.5 }}
              animate={{ scale: 1, opacity: 0 }}
              transition={{ duration: 1.8, delay, repeat: Infinity, ease: 'easeOut' }}
            />
          ))}
          <div
            className="rounded-[26%] overflow-hidden relative z-10"
            style={{ boxShadow: `0 0 0 3px color-mix(in srgb, ${accent} 55%, transparent), 0 12px 40px color-mix(in srgb, ${accent} 30%, transparent)` }}
          >
            <ChessAvatar address={myAddress} size={84} />
          </div>
        </div>

        {/* heading */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white" style={{ fontFamily: 'var(--fd)', textShadow: 'var(--king-text-shadow)' }}>
            Waiting for Opponent
          </h2>
          <div className="flex items-center gap-2">
            <ChessName address={myAddress} profile={profileMap[myAddress.toLowerCase()]} className="text-xs font-bold text-[var(--t2)]" />
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-[0.2em] uppercase" style={{ color: accent, border: `1px solid color-mix(in srgb, ${accent} 40%, transparent)`, fontFamily: 'var(--fd)' }}>
              {myColor}
            </span>
          </div>
          <p className="text-xs text-[var(--t3)] tracking-wide max-w-xs leading-relaxed">
            The match starts automatically the moment someone joins.
          </p>
        </div>

        {/* match ID */}
        <div className="w-full flex flex-col items-center gap-2">
          <span className="text-[9px] font-black tracking-[0.3em] uppercase text-[var(--t3)]">Match ID</span>
          <button
            onClick={copyId}
            className="group flex items-center gap-3 px-6 py-3 rounded-2xl bg-black/40 border border-white/10 hover:border-[var(--c)]/40 hover:bg-black/60 transition-colors"
          >
            <span className="text-3xl font-black text-white tabular-nums leading-none" style={{ fontFamily: 'var(--fd)' }}>#{gameId}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--t3)] group-hover:text-[var(--c)] transition-colors">
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15V5a2 2 0 0 1 2-2h10" />
            </svg>
          </button>
        </div>

        {/* pot chip */}
        <div
          className="flex flex-col items-center gap-0.5 px-5 py-2.5 rounded-2xl"
          style={{ background: 'color-mix(in srgb, var(--candy-amber) 12%, rgba(0,0,0,0.5))', border: '1px solid color-mix(in srgb, var(--candy-amber) 38%, transparent)' }}
        >
          <span className="text-[9px] font-black tracking-[0.3em] uppercase" style={{ color: 'var(--candy-amber)', fontFamily: 'var(--fd)' }}>Winner Takes</span>
          <span className="text-lg font-black text-white leading-none" style={{ fontFamily: 'var(--fd)' }}>
            {pot} <span className="text-[11px]" style={{ color: 'var(--candy-amber)' }}>CHESS</span>
          </span>
        </div>

        {/* actions */}
        <div className="w-full flex flex-col gap-3 pt-2">
          <GlowButton variant="brand" fullWidth onClick={share}>SHARE INVITE</GlowButton>
          <GlowButton variant="ghost" fullWidth onClick={onLeave}>BACK TO LOBBY</GlowButton>
        </div>
      </div>
    </motion.div>
  )
}
