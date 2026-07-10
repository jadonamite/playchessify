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
import PodiumCard from '@/components/lobby/PodiumCard'

// ── constants ───────────────────────────────────────────────────────────────

const RANKS_PER_PAGE = 10

// ── helpers ─────────────────────────────────────────────────────────────────


const winRate = (e: LeaderboardEntry) =>
  e.gamesPlayed === 0 ? '—' : `${Math.round((e.wins / e.gamesPlayed) * 100)}%`

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

          {/* ── Grand Prix entry ribbon ── */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => router.push('/app/tournaments')}
            className="group relative w-full rounded-2xl px-5 py-3.5 flex items-center justify-between gap-3 overflow-hidden cursor-pointer text-left"
            style={{
              background: 'linear-gradient(135deg, rgba(255,215,0,0.10), rgba(0,204,255,0.06))',
              border: '1px solid rgba(255,215,0,0.30)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            <div
              aria-hidden
              className="absolute inset-y-0 -left-1/3 w-1/3 pointer-events-none -skew-x-12 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }}
            />
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl leading-none shrink-0">🏆</span>
              <div className="min-w-0">
                <div className="text-sm font-black tracking-wide truncate" style={{ fontFamily: 'var(--fd)', color: 'var(--t1)' }}>
                  WEEKLY GRAND PRIX{' '}
                  <span style={{ color: '#FFD24A' }}>· $100 POT</span>
                </div>
                <div className="text-[10px] font-bold tracking-widest uppercase text-[var(--t3)] mt-0.5">
                  Climb from zero · win the pot
                </div>
              </div>
            </div>
            <span
              className="text-[10px] font-black tracking-widest uppercase shrink-0 px-3 py-1.5 rounded-full"
              style={{ color: '#04070e', background: 'linear-gradient(180deg, #FFF6C2, #FFD24A 55%, #9C6B12)' }}
            >
              ENTER →
            </span>
          </motion.button>

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
                      address={entry.address}
                      rank={entry.rank as 1 | 2 | 3}
                      isMe={!!myAddress && entry.address === myAddress}
                      delay={0.1 + i * 0.09}
                      profileMap={profileMap}
                      hero={entry.rating}
                      heroLabel="ELO"
                      wins={entry.wins}
                      losses={entry.losses}
                      draws={entry.draws}
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
