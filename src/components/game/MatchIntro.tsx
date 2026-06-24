'use client'

import ChessAvatar from '@/components/ui/ChessAvatar'
import ChessName from '@/components/ui/ChessName'
import type { ChessProfile } from '@/types/profile'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { usePlayerStats } from '@/hooks/usePlayerStats'
import { useToastStore } from '@/hooks/useToastStore'

type Color = 'white' | 'black'
type SideMode = 'player' | 'bot' | 'searching'

interface MatchIntroProps {
  open: boolean
  isBot: boolean
  myAddress: string
  myColor: Color
  /** Opponent address — '' / zero while still finding (PvP). */
  opponentAddress: string
  /** PvP: true once the contract reports the game active (opponent joined). */
  opponentReady: boolean
  pot: string
  profileMap: Record<string, ChessProfile | null>
  gameId: number
  botLabel?: string
  onDone: () => void
  onLeave: () => void
}

const colorOf = (c: Color) => (c === 'white' ? 'var(--c)' : 'var(--candy-grape)')

/** `(min-width:1024px)` reactive flag — drives the slide direction per layout. */
function useIsDesktop() {
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const sync = () => setDesktop(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return desktop
}

/* ── one side of the split — player / bot / searching ── */
function Side({
  mode, address, color, isMe, botLabel, profileMap, slide, order,
}: {
  mode: SideMode
  address: string
  color: Color
  isMe: boolean
  botLabel?: string
  profileMap: Record<string, ChessProfile | null>
  slide: { x?: number; y?: number }
  order: string
}) {
  // Hook is always called; disabled (returns null) unless this is a real player.
  const stats = usePlayerStats(mode === 'player' ? address : null)
  const accent = colorOf(color)
  const tint = color === 'white'
    ? 'radial-gradient(circle at 50% 32%, color-mix(in srgb, var(--c) 15%, transparent), transparent 70%)'
    : 'radial-gradient(circle at 50% 68%, color-mix(in srgb, var(--candy-grape) 17%, transparent), transparent 70%)'

  return (
    <motion.div
      initial={{ opacity: 0, ...slide }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ type: 'spring', stiffness: 140, damping: 18 }}
      className={`relative flex-1 flex flex-col items-center justify-center gap-4 px-6 py-10 min-h-0 ${order}`}
      style={{ background: tint }}
    >
      {/* color badge */}
      <span
        className="px-3 py-1 rounded-full text-[10px] font-black tracking-[0.25em] uppercase"
        style={{ fontFamily: 'var(--fd)', color: accent, border: `1px solid color-mix(in srgb, ${accent} 40%, transparent)`, background: `color-mix(in srgb, ${accent} 12%, transparent)` }}
      >
        {color}
      </span>

      {/* avatar slot */}
      <AnimatePresence mode="popLayout">
        {mode === 'searching' ? (
          <motion.div
            key="searching"
            exit={{ opacity: 0, scale: 0.8 }}
            className="relative flex items-center justify-center"
            style={{ width: 110, height: 110 }}
          >
            {[0, 0.6, 1.2].map((d) => (
              <motion.span
                key={d}
                className="absolute rounded-full"
                style={{ width: 110, height: 110, border: `1.5px solid ${accent}` }}
                initial={{ scale: 0.45, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 0 }}
                transition={{ duration: 1.8, delay: d, repeat: Infinity, ease: 'easeOut' }}
              />
            ))}
            <div
              className="flex items-center justify-center rounded-[26%]"
              style={{ width: 96, height: 96, background: 'rgba(0,0,0,0.4)', border: `1px solid color-mix(in srgb, ${accent} 35%, transparent)`, color: accent }}
            >
              <span className="text-4xl font-black" style={{ fontFamily: 'var(--fd)' }}>?</span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="found"
            initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 15 }}
            className="relative shrink-0"
          >
            <div
              className="rounded-[26%] overflow-hidden flex items-center justify-center"
              style={{ width: 96, height: 96, boxShadow: `0 0 0 3px color-mix(in srgb, ${accent} 55%, transparent), 0 12px 40px color-mix(in srgb, ${accent} 30%, transparent)`, background: mode === 'bot' ? 'var(--btn-face)' : undefined }}
            >
              {mode === 'bot' ? (
                <span className="font-black" style={{ fontFamily: 'var(--fd)', fontSize: 30, color: '#001a22' }}>AI</span>
              ) : (
                <ChessAvatar address={address} size={96} />
              )}
            </div>
            {isMe && (
              <span
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-[0.2em] uppercase text-black"
                style={{ fontFamily: 'var(--fd)', background: accent }}
              >
                You
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* name banner */}
      <div className="relative max-w-[80vw]" style={{ transform: 'skewX(-9deg)' }}>
        <div
          className="relative overflow-hidden px-5 py-2 rounded-md"
          style={{ background: 'rgba(0,0,0,0.45)', border: `1px solid color-mix(in srgb, ${accent} 35%, transparent)`, color: accent }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1.4px)', backgroundSize: '6px 6px', opacity: 0.12 }}
          />
          <div style={{ transform: 'skewX(9deg)' }}>
            {mode === 'searching' ? (
              <span className="font-black tracking-wide text-base md:text-lg text-white inline-flex items-center gap-1">
                Finding<motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.2, repeat: Infinity }}>…</motion.span>
              </span>
            ) : mode === 'bot' ? (
              <span className="font-black tracking-wide text-lg md:text-xl text-white">{botLabel ?? 'PLAYCHESSIFY AI'}</span>
            ) : (
              <ChessName address={address} profile={profileMap[address.toLowerCase()]} className="font-black tracking-wide text-lg md:text-xl text-white" />
            )}
          </div>
        </div>
      </div>

      {/* ELO / tier */}
      <div className="flex flex-col items-center gap-0.5 h-12">
        {mode === 'player' && (
          <>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl md:text-4xl font-black text-white leading-none" style={{ fontFamily: 'var(--fd)' }}>
                {stats ? stats.rating : '—'}
              </span>
              <span className="text-[11px] font-bold tracking-widest" style={{ color: accent }}>ELO</span>
            </div>
            <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-[var(--t3)]">{stats ? stats.tier : ' '}</span>
          </>
        )}
        {mode === 'bot' && (
          <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-[var(--t3)] mt-2">Practice Match</span>
        )}
        {mode === 'searching' && (
          <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-[var(--t3)] mt-2">Scanning the lobby</span>
        )}
      </div>
    </motion.div>
  )
}

/* ── the actual VS page (only mounted while open) ── */
function MatchIntroInner({
  isBot, myAddress, opponentAddress, myColor, opponentReady, pot, profileMap, gameId, botLabel, onDone, onLeave,
}: Omit<MatchIntroProps, 'open'>) {
  const isDesktop = useIsDesktop()
  const showToast = useToastStore((s) => s.showToast)
  const [count, setCount] = useState<number | null>(null)
  const [botFound, setBotFound] = useState(false)
  const oppColor: Color = myColor === 'white' ? 'black' : 'white'

  const hasOpponent = !!opponentAddress && opponentAddress !== '0x0000000000000000000000000000000000000000'
  const found = isBot ? botFound : (opponentReady && hasOpponent)

  // Bot: simulate a short "finding" before the AI resolves.
  useEffect(() => {
    if (!isBot) return
    const t = setTimeout(() => setBotFound(true), 4200)
    return () => clearTimeout(t)
  }, [isBot])

  // Once the opponent is present, hold a beat then run the 3·2·1 countdown.
  useEffect(() => {
    if (!found) return
    const t = setTimeout(() => setCount(3), 900)
    return () => clearTimeout(t)
  }, [found])

  useEffect(() => {
    if (count === null) return
    if (count <= 0) { onDone(); return }
    const t = setTimeout(() => setCount((c) => (c === null ? null : c - 1)), 700)
    return () => clearTimeout(t)
  }, [count, onDone])

  const meSlide = isDesktop ? { x: -70 } : { y: 70 }
  const oppSlide = isDesktop ? { x: 70 } : { y: -70 }
  const oppMode: SideMode = found ? (isBot ? 'bot' : 'player') : 'searching'

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

  // Only a present opponent + reveal can be skipped; you can't skip "finding".
  const handleTap = () => { if (found) onDone() }
  const showCreatorFooter = !isBot && !found

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleTap}
      className="fixed inset-0 z-[60] flex flex-col lg:flex-row overflow-hidden select-none bg-[var(--bg)]"
      style={{ cursor: found ? 'pointer' : 'default' }}
    >
      {/* grid backdrop */}
      <div
        className="absolute inset-0 pointer-events-none z-0 opacity-40"
        style={{ backgroundImage: 'linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px)', backgroundSize: '52px 52px' }}
      />

      <Side
        mode={oppMode}
        address={opponentAddress}
        color={oppColor}
        isMe={false}
        botLabel={botLabel}
        profileMap={profileMap}
        slide={oppSlide}
        order="order-1 lg:order-2"
      />
      <Side
        mode="player"
        address={myAddress}
        color={myColor}
        isMe
        profileMap={profileMap}
        slide={meSlide}
        order="order-2 lg:order-1"
      />

      {/* diagonal seam */}
      <div className="lg:hidden absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px z-10 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, var(--c), transparent)', transform: 'translateY(-50%) rotate(-3deg)', boxShadow: '0 0 24px var(--c)' }} />
      <div className="hidden lg:block absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px z-10 pointer-events-none" style={{ background: 'linear-gradient(180deg, transparent, var(--c), transparent)', transform: 'translateX(-50%) rotate(3deg)', boxShadow: '0 0 24px var(--c)' }} />

      {/* center lockup */}
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 pointer-events-none">
        <motion.div
          initial={{ scale: 0, opacity: 0.6 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{ duration: 0.9, delay: 0.35, ease: 'easeOut' }}
          className="absolute w-28 h-28 rounded-full"
          style={{ border: '2px solid var(--c)' }}
        />
        <motion.div
          initial={{ scale: 0, rotate: -25, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 13, delay: 0.3 }}
          className="flex items-center justify-center"
          style={{ width: 104, height: 104, borderRadius: 30, color: '#001a22', background: 'var(--btn-face)', boxShadow: 'var(--btn-shadow)' }}
        >
          <span className="font-black leading-none" style={{ fontFamily: 'var(--fd)', fontSize: 44, letterSpacing: '-0.04em' }}>VS</span>
        </motion.div>

        {/* pot / practice chip */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-2xl"
          style={{ background: 'color-mix(in srgb, var(--candy-amber) 14%, rgba(0,0,0,0.6))', border: '1px solid color-mix(in srgb, var(--candy-amber) 40%, transparent)' }}
        >
          {isBot ? (
            <span className="text-[11px] font-black tracking-[0.3em] uppercase py-0.5" style={{ color: 'var(--candy-amber)', fontFamily: 'var(--fd)' }}>Friendly Match</span>
          ) : (
            <>
              <span className="text-[9px] font-black tracking-[0.3em] uppercase" style={{ color: 'var(--candy-amber)', fontFamily: 'var(--fd)' }}>Winner Takes</span>
              <span className="text-lg font-black text-white leading-none" style={{ fontFamily: 'var(--fd)' }}>
                {pot} <span className="text-[11px]" style={{ color: 'var(--candy-amber)' }}>CHESS</span>
              </span>
            </>
          )}
        </motion.div>

        {/* countdown */}
        <AnimatePresence mode="popLayout">
          {count !== null && count > 0 && (
            <motion.span
              key={count}
              initial={{ scale: 1.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="text-2xl font-black tabular-nums"
              style={{ fontFamily: 'var(--fd)', color: 'var(--c)' }}
            >
              {count}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* creator finding footer — share / copy / leave */}
      {showCreatorFooter && (
        <div className="absolute bottom-6 inset-x-0 z-30 flex flex-col items-center gap-3 px-6">
          <div className="flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); copyId() }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/40 border border-white/10 hover:border-[var(--c)]/40 transition-colors">
              <span className="text-sm font-black text-white tabular-nums" style={{ fontFamily: 'var(--fd)' }}>#{gameId}</span>
              <span className="text-[9px] font-bold tracking-widest uppercase text-[var(--t3)]">Copy ID</span>
            </button>
            <button onClick={(e) => { e.stopPropagation(); share() }} className="px-4 py-2 rounded-xl bg-black/40 border border-white/10 hover:border-[var(--c)]/40 transition-colors text-[10px] font-black tracking-widest uppercase text-[var(--c)]">
              Share Invite
            </button>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onLeave() }} className="text-[10px] font-bold tracking-[0.25em] uppercase text-[var(--t3)] hover:text-white transition-colors">
            ← Back to lobby
          </button>
        </div>
      )}

      {/* skip hint (only once an opponent is present) */}
      {found && (
        <div className="absolute bottom-5 inset-x-0 z-30 text-center pointer-events-none">
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[var(--t3)]">Tap to skip</span>
        </div>
      )}
    </motion.div>
  )
}

export default function MatchIntro(props: MatchIntroProps) {
  return (
    <AnimatePresence>
      {props.open && <MatchIntroInner {...props} />}
    </AnimatePresence>
  )
}
