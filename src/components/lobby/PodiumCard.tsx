'use client'

import { motion } from 'framer-motion'
import ChessName from '@/components/ui/ChessName'
import ChessAvatar from '@/components/ui/ChessAvatar'
import type { ChessProfile } from '@/types/profile'

// ── medal palettes (shared by the leaderboard + tournament podiums) ──────────
export const MEDAL = {
  1: {
    color: '#FFD700',
    glow: 'rgba(255,215,0,0.30)',
    border: 'rgba(255,215,0,0.45)',
    bg: 'rgba(255,215,0,0.05)',
    mLight: '#FFF6C2',
    mMid: '#FFD24A',
    mDeep: '#9C6B12',
    icon: '♛',
    title: 'GRANDMASTER',
    baseH: 104,
  },
  2: {
    color: '#DBE2EA',
    glow: 'rgba(200,210,225,0.22)',
    border: 'rgba(210,218,230,0.40)',
    bg: 'rgba(255,255,255,0.03)',
    mLight: '#FFFFFF',
    mMid: '#CFD6DE',
    mDeep: '#6E7885',
    icon: '♜',
    title: 'MASTER',
    baseH: 74,
  },
  3: {
    color: '#E0954E',
    glow: 'rgba(205,127,50,0.22)',
    border: 'rgba(205,127,50,0.40)',
    bg: 'rgba(205,127,50,0.035)',
    mLight: '#FFD9A0',
    mMid: '#D08A45',
    mDeep: '#6E4018',
    icon: '♝',
    title: 'EXPERT',
    baseH: 56,
  },
} as const

export interface PodiumCardProps {
  address: string
  rank: 1 | 2 | 3
  isMe: boolean
  delay: number
  profileMap: Record<string, ChessProfile | null>
  /** The big metallic hero number (ELO on the leaderboard, XP in a tournament). */
  hero: number | string
  heroLabel: string
  wins: number
  losses: number
  draws: number
  /** Overrides the medal title pill (e.g. CHAMPION / 2ND / 3RD in tournaments). */
  title?: string
  /** Optional prize badge, shown under the title. */
  prize?: string
}

// ── podium card (rank 1–3) ───────────────────────────────────────────────────
export default function PodiumCard({
  address,
  rank,
  isMe,
  delay,
  profileMap,
  hero,
  heroLabel,
  wins,
  losses,
  draws,
  title,
  prize,
}: PodiumCardProps) {
  const m = MEDAL[rank]
  const isFirst = rank === 1
  const avatar = isFirst ? 66 : 48
  const coin = avatar + 22

  // shared metallic fills
  const metalV = `linear-gradient(180deg, ${m.mLight} 0%, ${m.mMid} 46%, ${m.mDeep} 100%)`
  const coinFill = `radial-gradient(circle at 50% 30%, ${m.mLight}, ${m.mMid} 55%, ${m.mDeep} 100%)`

  return (
    <motion.div
      initial={{ opacity: 0, y: 44, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: 'spring', damping: 18, stiffness: 180 }}
      className="flex-1 min-w-0 flex flex-col items-center relative"
      style={{ maxWidth: isFirst ? 210 : 172 }}
    >
      {/* champion spotlight — soft god-ray cone from above */}
      {isFirst && (
        <div
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 -top-2 pointer-events-none"
          style={{
            width: 150,
            height: 260,
            background: `linear-gradient(180deg, ${m.color}22, transparent 72%)`,
            clipPath: 'polygon(38% 0, 62% 0, 100% 100%, 0 100%)',
            filter: 'blur(6px)',
          }}
        />
      )}

      {/* ── floating champion card ── */}
      <div className="relative z-10 flex flex-col items-center gap-1.5 w-full px-1 pb-3">

        {/* crown — only the leader wears it, and it breathes */}
        {isFirst && (
          <motion.div
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: delay + 0.22, type: 'spring', damping: 12 }}
            className="-mb-1 select-none"
          >
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              className="text-2xl sm:text-3xl leading-none"
              style={{ color: m.color, filter: `drop-shadow(0 0 16px ${m.glow})` }}
            >
              {m.icon}
            </motion.div>
          </motion.div>
        )}

        {/* ── metallic coin medallion holding the avatar ── */}
        <div
          className="relative flex items-center justify-center shrink-0"
          style={{ width: coin, height: coin }}
        >
          {/* outer bloom */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{ width: coin + 16, height: coin + 16, background: `radial-gradient(circle, ${m.color}44, transparent 70%)` }}
          />
          {/* minted coin ring */}
          <div
            className="absolute rounded-full"
            style={{
              width: coin,
              height: coin,
              background: coinFill,
              boxShadow: `0 4px 14px rgba(0,0,0,0.55), 0 0 26px ${m.glow}, inset 0 2px 3px ${m.mLight}, inset 0 -3px 5px rgba(0,0,0,0.45)`,
            }}
          />
          {/* specular highlight on the coin */}
          <div
            aria-hidden
            className="absolute rounded-full pointer-events-none"
            style={{
              width: coin * 0.5,
              height: coin * 0.32,
              top: coin * 0.1,
              left: coin * 0.16,
              background: 'radial-gradient(circle, rgba(255,255,255,0.75), transparent 70%)',
              filter: 'blur(2px)',
            }}
          />
          {/* inner avatar disc, recessed into the coin */}
          <div
            className="relative rounded-full overflow-hidden flex items-center justify-center"
            style={{
              width: avatar,
              height: avatar,
              background: 'radial-gradient(circle at 50% 38%, rgba(20,28,44,0.6), rgba(6,10,20,0.96))',
              boxShadow: `inset 0 0 0 2px rgba(0,0,0,0.5), inset 0 2px 8px rgba(0,0,0,0.7)`,
            }}
          >
            <ChessAvatar address={address} size={avatar - 10} />
          </div>
          {isMe && (
            <div
              className="absolute top-0 right-1 w-2.5 h-2.5 rounded-full animate-pulse z-10"
              style={{ background: 'var(--c)', boxShadow: '0 0 8px var(--c)' }}
            />
          )}
        </div>

        {/* ── chrome bracket-corner glass card: title · name · hero ── */}
        <div
          className="relative w-full mt-1 rounded-xl px-2.5 pt-2.5 pb-2 flex flex-col items-center gap-1"
          style={{
            background: 'linear-gradient(180deg, rgba(10,16,28,0.72), rgba(4,7,14,0.82))',
            border: `1px solid ${m.border}`,
            boxShadow: `inset 0 1px 0 ${m.color}33, 0 10px 30px rgba(0,0,0,0.4)`,
            backdropFilter: 'blur(6px)',
          }}
        >
          {/* metallic L-bracket corners */}
          {([
            { top: -1, left: -1, borderTop: `2px solid ${m.color}`, borderLeft: `2px solid ${m.color}`, borderTopLeftRadius: 6 },
            { top: -1, right: -1, borderTop: `2px solid ${m.color}`, borderRight: `2px solid ${m.color}`, borderTopRightRadius: 6 },
            { bottom: -1, left: -1, borderBottom: `2px solid ${m.color}`, borderLeft: `2px solid ${m.color}`, borderBottomLeftRadius: 6 },
            { bottom: -1, right: -1, borderBottom: `2px solid ${m.color}`, borderRight: `2px solid ${m.color}`, borderBottomRightRadius: 6 },
          ] as React.CSSProperties[]).map((corner, i) => (
            <span
              key={i}
              aria-hidden
              className="absolute w-2.5 h-2.5 pointer-events-none"
              style={{ ...corner, filter: `drop-shadow(0 0 4px ${m.glow})` }}
            />
          ))}

          {/* title */}
          <span
            className="text-[7px] sm:text-[8px] font-black tracking-[0.16em] whitespace-nowrap"
            style={{ fontFamily: 'var(--fd)', color: m.color, textShadow: `0 0 10px ${m.glow}` }}
          >
            {title ?? m.title}
          </span>

          {/* prize badge */}
          {prize && (
            <span
              className="text-[9px] font-black tracking-wide px-2 py-0.5 rounded-full"
              style={{
                fontFamily: 'var(--fd)',
                color: '#04070e',
                backgroundImage: metalV,
                boxShadow: `0 0 12px ${m.glow}`,
              }}
            >
              {prize}
            </span>
          )}

          {/* name */}
          <ChessName
            address={address}
            profile={profileMap[address.toLowerCase()]}
            badge
            asLink
            className="font-bold text-[10px] sm:text-xs tracking-wide truncate max-w-full text-center"
            style={{ color: isMe ? 'var(--c)' : 'var(--t1)' }}
          />
          {isMe && (
            <span
              className="text-[7px] font-black tracking-widest uppercase -mt-0.5"
              style={{ color: 'var(--c)', fontFamily: 'var(--fd)' }}
            >
              ⚡ YOU
            </span>
          )}

          {/* hero — metallic gradient fill */}
          <div className="text-center leading-none mt-0.5">
            <div
              className="font-black"
              style={{
                fontFamily: 'var(--fd)',
                fontSize: isFirst ? 30 : 22,
                backgroundImage: metalV,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: `drop-shadow(0 1px 1px rgba(0,0,0,0.5)) drop-shadow(0 0 18px ${m.glow})`,
              }}
            >
              {hero}
            </div>
            <div className="text-[7px] font-black tracking-[0.2em] uppercase mt-1 text-[var(--t3)]">{heroLabel}</div>
          </div>

          {/* compact W / L / D */}
          <div className="flex items-center gap-1 text-[9px] font-black" style={{ fontFamily: 'var(--fd)' }}>
            <span className="text-green-400">{wins}</span>
            <span className="text-gray-600">/</span>
            <span className="text-red-400">{losses}</span>
            <span className="text-gray-600">/</span>
            <span className="text-gray-400">{draws}</span>
          </div>
        </div>
      </div>

      {/* ── dimensional metal pedestal ── */}
      <motion.div
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: delay + 0.1, type: 'spring', damping: 20, stiffness: 160 }}
        className="w-full relative origin-bottom"
        style={{ height: m.baseH }}
      >
        {/* top face — the lit surface the number rests on */}
        <div
          className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-[50%] z-20"
          style={{
            width: '86%',
            height: 12,
            background: `linear-gradient(180deg, ${m.mLight}, ${m.mMid})`,
            boxShadow: `0 0 18px ${m.glow}, inset 0 1px 1px ${m.mLight}`,
          }}
        />
        {/* front face — curved metal riser */}
        <div
          className="absolute inset-0 top-1 rounded-t-lg overflow-hidden flex items-start justify-center"
          style={{
            background: metalV,
            borderTop: `1px solid ${m.mLight}`,
            borderLeft: `1px solid ${m.mDeep}`,
            borderRight: `1px solid ${m.mDeep}`,
            boxShadow: `inset 0 2px 2px ${m.mLight}, inset 14px 0 22px -10px rgba(0,0,0,0.6), inset -14px 0 22px -10px rgba(0,0,0,0.6), 0 -8px 30px ${m.glow}`,
          }}
        >
          {/* cylindrical shading — dark edges, bright centre */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.42), transparent 32%, transparent 68%, rgba(0,0,0,0.42))' }}
          />
          {/* animated specular sweep */}
          <motion.div
            aria-hidden
            initial={{ x: '-140%' }}
            animate={{ x: '160%' }}
            transition={{ duration: isFirst ? 3.4 : 4.6, ease: 'easeInOut', repeat: Infinity, repeatDelay: isFirst ? 1.6 : 3, delay: delay + 0.7 }}
            className="absolute inset-y-0 w-1/4 pointer-events-none -skew-x-12"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)' }}
          />
          {/* embossed rank number */}
          <span
            className="font-black leading-none mt-3 select-none relative"
            style={{
              fontFamily: 'var(--fd)',
              fontSize: isFirst ? 38 : 28,
              color: m.mDeep,
              textShadow: `0 1px 0 ${m.mLight}, 0 -1px 1px rgba(0,0,0,0.4)`,
            }}
          >
            {rank}
          </span>
        </div>
        {/* mirror reflection puddle */}
        <div
          aria-hidden
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 pointer-events-none"
          style={{ width: '70%', height: 10, background: `radial-gradient(ellipse, ${m.color}55, transparent 72%)`, filter: 'blur(3px)' }}
        />
      </motion.div>
    </motion.div>
  )
}
