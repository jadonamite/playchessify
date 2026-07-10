'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/components/wallet-provider'
import GlowButton from '@/components/ui/GlowButton'
import PlayCard from '@/components/ui/PlayCard'
import LoadingState from '@/components/ui/LoadingState'
import { useLeaderboard, type LeaderboardEntry } from '@/hooks/useLeaderboard'
import { useBatchProfiles } from '@/hooks/useBatchProfiles'
import ChessName from '@/components/ui/ChessName'
import ChessAvatar from '@/components/ui/ChessAvatar'
import PageBackground from '@/components/ui/PageBackground'

// ── constants ───────────────────────────────────────────────────────────────

const RANKS_PER_PAGE = 10

const MEDAL = {
  1: {
    color: '#FFD700',
    glow: 'rgba(255,215,0,0.30)',
    border: 'rgba(255,215,0,0.45)',
    bg: 'rgba(255,215,0,0.05)',
    // metallic stops: highlight → body → deep shadow
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

// ── helpers ─────────────────────────────────────────────────────────────────


const winRate = (e: LeaderboardEntry) =>
  e.gamesPlayed === 0 ? '—' : `${Math.round((e.wins / e.gamesPlayed) * 100)}%`

// ── podium card (rank 1–3) ───────────────────────────────────────────────────

function PodiumCard({
  entry,
  isMe,
  delay,
  profileMap,
}: {
  entry: LeaderboardEntry
  isMe: boolean
  delay: number
  profileMap: Record<string, import('@/types/profile').ChessProfile | null>
}) {
  const rank = entry.rank as 1 | 2 | 3
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
            <ChessAvatar address={entry.address} size={avatar - 10} />
          </div>
          {isMe && (
            <div
              className="absolute top-0 right-1 w-2.5 h-2.5 rounded-full animate-pulse z-10"
              style={{ background: 'var(--c)', boxShadow: '0 0 8px var(--c)' }}
            />
          )}
        </div>

        {/* ── chrome bracket-corner glass card: title · name · ELO ── */}
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
            {m.title}
          </span>

          {/* name */}
          <ChessName
            address={entry.address}
            profile={profileMap[entry.address.toLowerCase()]}
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

          {/* ELO — metallic gradient fill */}
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
              {entry.rating}
            </div>
            <div className="text-[7px] font-black tracking-[0.2em] uppercase mt-1 text-[var(--t3)]">ELO</div>
          </div>

          {/* compact W / L / D */}
          <div className="flex items-center gap-1 text-[9px] font-black" style={{ fontFamily: 'var(--fd)' }}>
            <span className="text-green-400">{entry.wins}</span>
            <span className="text-gray-600">/</span>
            <span className="text-red-400">{entry.losses}</span>
            <span className="text-gray-600">/</span>
            <span className="text-gray-400">{entry.draws}</span>
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

// ── rank row (4+) ────────────────────────────────────────────────────────────

function RankRow({
  entry,
  isMe,
  idx,
  profileMap,
}: {
  entry: LeaderboardEntry
  isMe: boolean
  idx: number
  profileMap: Record<string, import('@/types/profile').ChessProfile | null>
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.38 + idx * 0.045, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center justify-between px-6 md:px-8 py-5 transition-colors relative"
      style={{
        background: isMe ? 'rgba(0,204,255,0.04)' : undefined,
        borderLeft: isMe ? '2px solid var(--c)' : '2px solid transparent',
      }}
    >
      {/* Rank + identity */}
      <div className="flex items-center gap-4 min-w-0">
        <span
          className="text-[11px] font-black tracking-widest w-8 shrink-0 text-right"
          style={{ fontFamily: 'var(--fd)', color: 'var(--t3)' }}
        >
          #{entry.rank}
        </span>
        <ChessAvatar address={entry.address} size={30} />
        <div className="flex flex-col min-w-0">
          {isMe && (
            <span
              className="text-[8px] font-black tracking-widest uppercase mb-0.5"
              style={{ color: 'var(--c)', fontFamily: 'var(--fd)' }}
            >
              YOU
            </span>
          )}
          <ChessName
            address={entry.address}
            profile={profileMap[entry.address.toLowerCase()]}
            badge
            asLink
            className="font-bold text-sm tracking-wide truncate"
            style={{ color: isMe ? 'var(--c)' : 'var(--t1)' }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 md:gap-10 shrink-0">
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-[8px] text-gray-500 uppercase tracking-widest font-bold mb-0.5">W / L / D</span>
          <span className="text-xs font-black" style={{ fontFamily: 'var(--fd)' }}>
            <span className="text-green-400">{entry.wins}</span>
            <span className="text-gray-600 mx-0.5">/</span>
            <span className="text-red-400">{entry.losses}</span>
            <span className="text-gray-600 mx-0.5">/</span>
            <span className="text-gray-400">{entry.draws}</span>
          </span>
        </div>
        <div className="hidden md:flex flex-col items-end">
          <span className="text-[8px] text-gray-500 uppercase tracking-widest font-bold mb-0.5">WIN%</span>
          <span
            className="text-xs font-black text-[var(--t2)]"
            style={{ fontFamily: 'var(--fd)' }}
          >
            {winRate(entry)}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[8px] text-gray-500 uppercase tracking-widest font-bold mb-0.5">ELO</span>
          <span
            className="text-base font-black"
            style={{ fontFamily: 'var(--fd)', color: 'var(--c)' }}
          >
            {entry.rating}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ── main ─────────────────────────────────────────────────────────────────────

export default function LeaderboardContent() {
  const router = useRouter()
  const { playerAddress } = useWallet()
  const { entries, isLoading, myRank, refresh } = useLeaderboard()
  const { data: profileMap = {} } = useBatchProfiles(entries.map((e) => e.address))

  const myAddress = playerAddress?.toLowerCase()
  const top3 = entries.slice(0, 3)
  // Arrange the podium into classic stage order — 2nd · 1st · 3rd — so the
  // leader sits centre-stage and elevated. Holds on mobile (always a flex row).
  const podium = ([2, 1, 3] as const)
    .map((r) => top3.find((e) => e.rank === r))
    .filter((e): e is LeaderboardEntry => Boolean(e))
  const rest = entries.slice(3)
  const myEntry = myAddress ? entries.find((e) => e.address === myAddress) : null
  const myEntryNotInPodium = myEntry && (myEntry.rank ?? 0) > 3

  // Pagination — 10 commanders per page (ranks 4+)
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(rest.length / RANKS_PER_PAGE))
  const currentPage = Math.min(page, totalPages) // clamp if the list shrank after a refresh
  const pageItems = rest.slice((currentPage - 1) * RANKS_PER_PAGE, currentPage * RANKS_PER_PAGE)

  return (
    <main className="min-h-screen w-full bg-[var(--bg)] text-[var(--t1)] relative overflow-x-hidden flex flex-col">

      <PageBackground hero="queen" />

      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[8%] right-[8%] w-[32%] h-[32%] bg-[var(--c)] blur-[150px] rounded-full opacity-[0.055]" />
        <div className="absolute bottom-[12%] left-[6%] w-[28%] h-[28%] bg-[#6a0dad] blur-[130px] rounded-full opacity-[0.045]" />
        <div className="absolute top-[45%] left-[38%] w-[22%] h-[22%] bg-[#FFD700] blur-[140px] rounded-full opacity-[0.022]" />
      </div>

      {/* Grid */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />

      <div className="relative z-10 flex-1 flex flex-col items-center w-full px-4 md:px-8 py-12 md:py-20">
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-10">

          {/* ── Header ── */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <GlowButton variant="ghost" size="sm" onClick={() => router.push('/app/lobby')}>
                ← BACK TO LOBBY
              </GlowButton>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.07 }}
              className="flex flex-col items-start md:items-end gap-3"
            >
              <h1
                className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none"
                style={{ fontFamily: 'var(--fd)', textShadow: 'var(--hero-text-shadow)' }}
              >
                ELO{' '}
                <span style={{ color: 'var(--c)', textShadow: 'var(--king-text-shadow)' }}>
                  RANKINGS
                </span>
              </h1>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-black/40 py-1.5 px-3 rounded-full border border-white/10 shadow-inner">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--c)] animate-pulse" />
                  <span
                    className="text-[10px] tracking-[0.2em] font-bold text-[var(--c)]"
                    style={{ fontFamily: 'var(--fd)' }}
                  >
                    CELO
                  </span>
                </div>
                <span className="text-[10px] font-bold tracking-[0.2em] text-[var(--t3)] uppercase">
                  VERIFIED ON-CHAIN
                </span>
              </div>
            </motion.div>
          </div>

          {/* ── My rank callout (if connected + not in top 3) ── */}
          <AnimatePresence>
            {playerAddress && myEntryNotInPodium && myEntry && myRank && (
              <motion.div
                key="my-rank-banner"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: 0.14 }}
                className="rounded-2xl border border-[var(--b2)] px-6 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between backdrop-blur-sm"
                style={{ background: 'var(--b1)' }}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--c)] animate-pulse shrink-0" />
                  {myEntry && (
                    <ChessAvatar address={myEntry.address} size={36} />
                  )}
                  <div className="min-w-0">
                    <div
                      className="text-[8px] font-black tracking-[0.28em] uppercase mb-0.5"
                      style={{ fontFamily: 'var(--fd)', color: 'var(--t3)' }}
                    >
                      YOUR POSITION
                    </div>
                    {myEntry && (
                      <ChessName
                        address={myEntry.address}
                        profile={profileMap[myEntry.address.toLowerCase()]}
                        short
                        asLink
                        badge
                        className="font-bold text-sm tracking-wide truncate max-w-full"
                        style={{ color: 'var(--c)' }}
                      />
                    )}
                    <div
                      className="text-lg font-black mt-0.5"
                      style={{ fontFamily: 'var(--fd)', color: 'var(--t1)' }}
                    >
                      RANK #{myRank}
                    </div>
                  </div>
                </div>
                <div className="flex w-full justify-between sm:w-auto sm:justify-end gap-4 sm:gap-6 text-right">
                  <div>
                    <div className="text-[8px] text-gray-500 uppercase font-bold tracking-widest mb-0.5">ELO</div>
                    <div
                      className="text-lg font-black text-white"
                      style={{ fontFamily: 'var(--fd)' }}
                    >
                      {myEntry.rating}
                    </div>
                  </div>
                  <div>
                    <div className="text-[8px] text-gray-500 uppercase font-bold tracking-widest mb-0.5">WIN%</div>
                    <div
                      className="text-lg font-black text-[var(--t2)]"
                      style={{ fontFamily: 'var(--fd)' }}
                    >
                      {winRate(myEntry)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[8px] text-gray-500 uppercase font-bold tracking-widest mb-0.5">W / L</div>
                    <div className="text-lg font-black" style={{ fontFamily: 'var(--fd)' }}>
                      <span className="text-green-400">{myEntry.wins}</span>
                      <span className="text-gray-600 mx-0.5">/</span>
                      <span className="text-red-400">{myEntry.losses}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Body ── */}
          {isLoading ? (
            <div className="py-32">
              <LoadingState message="LOADING RANKINGS" />
            </div>
          ) : entries.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-40 text-center flex flex-col items-center gap-5"
            >
              <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center opacity-30">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                </svg>
              </div>
              <p
                className="text-sm font-bold tracking-widest text-[var(--t3)] uppercase"
              >
                No ranked players yet
              </p>
              <GlowButton
                variant="brand"
                size="sm"
                parallelogram
                onClick={() => router.push('/app/lobby')}
              >
                PLAY YOUR FIRST MATCH
              </GlowButton>
            </motion.div>
          ) : (
            <>
              {/* ── Podium (top 3) — always a horizontal stage, even on mobile ── */}
              {podium.length > 0 && (
                <div className="flex items-end justify-center gap-1.5 sm:gap-4 px-1">
                  {podium.map((entry, i) => (
                    <PodiumCard
                      key={entry.address}
                      entry={entry}
                      isMe={!!myAddress && entry.address === myAddress}
                      delay={0.1 + i * 0.09}
                      profileMap={profileMap}
                    />
                  ))}
                </div>
              )}

              {/* ── Ranks 4+ ── */}
              {rest.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
                >
                 <PlayCard size="hero">
                  {/* Table header */}
                  <div className="px-6 md:px-8 py-4 border-b border-white/5 flex items-center justify-between">
                    <span
                      className="text-[10px] font-black tracking-[0.25em] text-[var(--t3)] uppercase"
                      style={{ fontFamily: 'var(--fd)' }}
                    >
                      All Commanders
                    </span>
                    <button
                      onClick={refresh}
                      className="text-[9px] font-black tracking-widest uppercase text-[var(--t3)] hover:text-[var(--c)] transition-colors cursor-pointer"
                    >
                      ↻ REFRESH
                    </button>
                  </div>

                  <div className="divide-y divide-white/5">
                    <AnimatePresence mode="popLayout">
                      {pageItems.map((entry, idx) => (
                        <RankRow
                          key={entry.address}
                          entry={entry}
                          isMe={!!myAddress && entry.address === myAddress}
                          idx={idx}
                          profileMap={profileMap}
                        />
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="px-6 md:px-8 py-4 border-t border-white/5 flex items-center justify-between gap-4">
                      <GlowButton
                        variant="ghost"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => setPage(currentPage - 1)}
                      >
                        ← PREV
                      </GlowButton>
                      <span
                        className="text-[10px] font-black tracking-[0.25em] uppercase text-[var(--t3)] whitespace-nowrap"
                        style={{ fontFamily: 'var(--fd)' }}
                      >
                        Page {currentPage} of {totalPages}
                      </span>
                      <GlowButton
                        variant="ghost"
                        size="sm"
                        disabled={currentPage === totalPages}
                        onClick={() => setPage(currentPage + 1)}
                      >
                        NEXT →
                      </GlowButton>
                    </div>
                  )}
                 </PlayCard>
                </motion.div>
              )}

              {/* Bottom refresh */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
                className="flex justify-center pb-4"
              >
                <GlowButton variant="ghost" size="sm" onClick={refresh}>
                  ↻ REFRESH RANKINGS
                </GlowButton>
              </motion.div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
