'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ChessProfile } from '@/types/profile'
import ChessAvatar from '@/components/ui/ChessAvatar'
import ChessName from '@/components/ui/ChessName'
import { usePlayerStats } from '@/hooks/usePlayerStats'

type Color = 'white' | 'black'

interface MatchIntroProps {
  open: boolean
  myAddress: string
  opponentAddress: string
  myColor: Color
  /** Total pot (both wagers), already formatted to a whole number. */
  pot: string
  profileMap: Record<string, ChessProfile | null>
  onDone: () => void
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

/* ── one player's side of the split ── */
function PlayerSide({
  address, color, profileMap, isMe, slide, order,
}: {
  address: string
  color: Color
  profileMap: Record<string, ChessProfile | null>
  isMe: boolean
  slide: { x?: number; y?: number }
  order: string
}) {
  const stats = usePlayerStats(address)
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

      {/* avatar with glossy ring */}
      <div className='relative shrink-0'>
        <div
          className="rounded-[26%] overflow-hidden"
          style={{ boxShadow: `0 0 0 3px color-mix(in srgb, ${accent} 55%, transparent), 0 12px 40px color-mix(in srgb, ${accent} 30%, transparent)` }}
        >
          <ChessAvatar address={address} size={96} />
        </div>
        {isMe && (
          <span
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-[0.2em] uppercase text-black"
            style={{ fontFamily: 'var(--fd)', background: accent }}
          >
            You
          </span>
        )}
      </div>

      {/* name banner — skewed parallelogram w/ halftone, echoing the matchup refs */}
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
            <ChessName
              address={address}
              profile={profileMap[address.toLowerCase()]}
              className="font-black tracking-wide text-lg md:text-xl text-white"
            />
          </div>
        </div>
      </div>

      {/* ELO + tier */}
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl md:text-4xl font-black text-white leading-none" style={{ fontFamily: 'var(--fd)' }}>
            {stats ? stats.rating : '—'}
          </span>
          <span className="text-[11px] font-bold tracking-widest" style={{ color: accent }}>ELO</span>
        </div>
        <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-[var(--t3)]">
          {stats ? stats.tier : ' '}
        </span>
      </div>
    </motion.div>
  )
}

/* ── the actual reveal (only mounted while open) ── */
function MatchIntroInner({
  myAddress, opponentAddress, myColor, pot, profileMap, onDone,
}: Omit<MatchIntroProps, 'open'>) {
  const isDesktop = useIsDesktop()
  const [count, setCount] = useState<number | null>(null)
  const oppColor: Color = myColor === 'white' ? 'black' : 'white'

  // entrance → then start the 3·2·1 countdown
  useEffect(() => {
    const t = setTimeout(() => setCount(3), 1300)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (count === null) return
    if (count <= 0) { onDone(); return }
    const t = setTimeout(() => setCount((c) => (c === null ? null : c - 1)), 750)
    return () => clearTimeout(t)
  }, [count, onDone])

  // slide from opposite edges — left/right on desktop, top/bottom on mobile
  const meSlide = isDesktop ? { x: -70 } : { y: 70 }
  const oppSlide = isDesktop ? { x: 70 } : { y: -70 }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDone}
      className="fixed inset-0 z-[60] flex flex-col lg:flex-row overflow-hidden cursor-pointer select-none bg-[var(--bg)]"
    >
      {/* grid backdrop (matches lobby) */}
      <div
        className="absolute inset-0 pointer-events-none z-0 opacity-40"
        style={{ backgroundImage: 'linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px)', backgroundSize: '52px 52px' }}
      />

      <PlayerSide
        address={opponentAddress}
        color={oppColor}
        profileMap={profileMap}
        isMe={false}
        slide={oppSlide}
        order="order-1 lg:order-2"
      />
      <PlayerSide
        address={myAddress}
        color={myColor}
        profileMap={profileMap}
        isMe
        slide={meSlide}
        order="order-2 lg:order-1"
      />

      {/* diagonal seam — horizontal on mobile, vertical on desktop */}
      <div className="lg:hidden absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px z-10 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, var(--c), transparent)', transform: 'translateY(-50%) rotate(-3deg)', boxShadow: '0 0 24px var(--c)' }} />
      <div className="hidden lg:block absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px z-10 pointer-events-none" style={{ background: 'linear-gradient(180deg, transparent, var(--c), transparent)', transform: 'translateX(-50%) rotate(3deg)', boxShadow: '0 0 24px var(--c)' }} />

      {/* center lockup — VS badge + pot + countdown */}
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 pointer-events-none">
        {/* shockwave ring */}
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

        {/* pot chip */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-2xl"
          style={{ background: 'color-mix(in srgb, var(--candy-amber) 14%, rgba(0,0,0,0.6))', border: '1px solid color-mix(in srgb, var(--candy-amber) 40%, transparent)' }}
        >
          <span className="text-[9px] font-black tracking-[0.3em] uppercase" style={{ color: 'var(--candy-amber)', fontFamily: 'var(--fd)' }}>Winner Takes</span>
          <span className="text-lg font-black text-white leading-none" style={{ fontFamily: 'var(--fd)' }}>
            {pot} <span className="text-[11px]" style={{ color: 'var(--candy-amber)' }}>CHESS</span>
          </span>
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

      {/* skip hint */}
      <div className="absolute bottom-5 inset-x-0 z-30 text-center pointer-events-none">
        <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[var(--t3)]">Tap to skip</span>
      </div>
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
