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
    glow: 'rgba(255,215,0,0.28)',
    border: 'rgba(255,215,0,0.35)',
    bg: 'rgba(255,215,0,0.04)',
    icon: '♛',
    title: 'GRANDMASTER',
    baseH: 96,
  },
  2: {
    color: '#C0C0C0',
    glow: 'rgba(192,192,192,0.18)',
    border: 'rgba(192,192,192,0.28)',
    bg: 'rgba(255,255,255,0.02)',
    icon: '♜',
    title: 'MASTER',
    baseH: 66,
  },
  3: {
    color: '#CD7F32',
    glow: 'rgba(205,127,50,0.18)',
    border: 'rgba(205,127,50,0.28)',
    bg: 'rgba(205,127,50,0.025)',
    icon: '♝',
    title: 'EXPERT',
    baseH: 48,
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
  const avatar = isFirst ? 60 : 46

  return (
    <motion.div
      initial={{ opacity: 0, y: 44, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: 'spring', damping: 18, stiffness: 180 }}
      className="flex-1 min-w-0 flex flex-col items-center"
      style={{ maxWidth: isFirst ? 200 : 168 }}
    >
      {/* ── floating champion card ── */}
      <div className="relative flex flex-col items-center gap-1.5 w-full px-1 pb-3">

        {/* crown — only the leader wears it */}
        {isFirst && (
          <motion.div
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: delay + 0.22, type: 'spring', damping: 12 }}
            className="text-2xl sm:text-3xl leading-none -mb-1 select-none"
            style={{ color: m.color, filter: `drop-shadow(0 0 16px ${m.glow})` }}
          >
            {m.icon}
          </motion.div>
        )}

        {/* avatar — radial bloom + spinning dashed ring + accent frame */}
        <div
          className="relative flex items-center justify-center shrink-0"
          style={{ width: avatar + 18, height: avatar + 18 }}
        >
          <div
            className="absolute rounded-full pointer-events-none"
            style={{ width: avatar + 30, height: avatar + 30, background: `radial-gradient(circle, ${m.color}55, transparent 70%)` }}
          />
          <div
            className="absolute rounded-full pointer-events-none"
            style={{ width: avatar + 18, height: avatar + 18, border: `2px dashed ${m.color}`, opacity: 0.45, animation: `spin ${isFirst ? 16 : 24}s linear infinite` }}
          />
          <div
            className="relative rounded-full overflow-hidden flex items-center justify-center"
            style={{
              width: avatar,
              height: avatar,
              border: `2px solid ${m.color}`,
              background: `radial-gradient(circle at 50% 38%, ${m.color}30, rgba(8,13,26,0.94))`,
              boxShadow: `0 0 0 4px ${m.color}1f, 0 0 26px ${m.glow}`,
            }}
          >
            <ChessAvatar address={entry.address} size={avatar - 8} />
          </div>
          {isMe && (
            <div
              className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ background: 'var(--c)', boxShadow: '0 0 8px var(--c)' }}
            />
          )}
        </div>

        {/* rarity-style title pill */}
        <div
          className="px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(4,6,15,0.72)', border: `1px solid ${m.border}` }}
        >
          <span
            className="text-[7px] sm:text-[8px] font-black tracking-[0.12em] whitespace-nowrap"
            style={{ fontFamily: 'var(--fd)', color: m.color }}
          >
            {m.title}
          </span>
        </div>

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

        {/* ELO */}
        <div className="text-center leading-none mt-0.5">
          <div
            className="font-black"
            style={{ fontFamily: 'var(--fd)', color: m.color, fontSize: isFirst ? 30 : 22, textShadow: `0 0 28px ${m.glow}` }}
          >
            {entry.rating}
          </div>
          <div className="text-[7px] font-black tracking-[0.2em] uppercase mt-1 text-[var(--t3)]">ELO</div>
        </div>

        {/* compact W / L / D */}
        <div className="flex items-center gap-1 text-[9px] font-black mt-0.5" style={{ fontFamily: 'var(--fd)' }}>
          <span className="text-green-400">{entry.wins}</span>
          <span className="text-gray-600">/</span>
          <span className="text-red-400">{entry.losses}</span>
          <span className="text-gray-600">/</span>
          <span className="text-gray-400">{entry.draws}</span>
        </div>
      </div>

      {/* ── podium base step (stair-stepped by rank) ── */}
      <motion.div
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: delay + 0.1, type: 'spring', damping: 20, stiffness: 160 }}
        className="w-full rounded-t-2xl relative overflow-hidden flex items-start justify-center origin-bottom"
        style={{
          height: m.baseH,
          background: `linear-gradient(180deg, ${m.color}24, ${m.bg})`,
          borderTop: `1.5px solid ${m.border}`,
          borderLeft: `1px solid ${m.border}`,
          borderRight: `1px solid ${m.border}`,
          boxShadow: `inset 0 1px 0 ${m.color}40, 0 -10px 34px ${m.glow}`,
        }}
      >
        {/* faint vertical sheen */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `linear-gradient(90deg, transparent, ${m.color}10 50%, transparent)` }}
        />
        <span
          className="font-black leading-none mt-2 select-none"
          style={{ fontFamily: 'var(--fd)', fontSize: isFirst ? 32 : 24, color: m.color, opacity: 0.92, textShadow: `0 0 22px ${m.glow}` }}
        >
          {rank}
        </span>
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
                className="rounded-2xl border border-[var(--b2)] px-6 py-4 flex items-center justify-between backdrop-blur-sm"
                style={{ background: 'var(--b1)' }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--c)] animate-pulse shrink-0" />
                  {myEntry && (
                    <ChessAvatar address={myEntry.address} size={36} />
                  )}
                  <div>
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
                        className="font-bold text-sm tracking-wide"
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
                <div className="flex gap-6 text-right">
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
