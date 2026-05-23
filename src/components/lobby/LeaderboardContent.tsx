'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import GlowButton from '@/components/ui/GlowButton'
import LoadingState from '@/components/ui/LoadingState'
import { Navbar } from '@/components/landing/Hero'
import { useLeaderboard, type LeaderboardEntry } from '@/hooks/useLeaderboard'

// ── constants ───────────────────────────────────────────────────────────────

const MEDAL = {
  1: {
    color: '#FFD700',
    glow: 'rgba(255,215,0,0.28)',
    border: 'rgba(255,215,0,0.35)',
    bg: 'rgba(255,215,0,0.06)',
    icon: '♛',
    title: 'GRANDMASTER',
    minH: 'min-h-[360px]',
  },
  2: {
    color: '#C0C0C0',
    glow: 'rgba(192,192,192,0.18)',
    border: 'rgba(192,192,192,0.28)',
    bg: 'rgba(255,255,255,0.025)',
    icon: '♜',
    title: 'MASTER',
    minH: 'min-h-[300px]',
  },
  3: {
    color: '#CD7F32',
    glow: 'rgba(205,127,50,0.18)',
    border: 'rgba(205,127,50,0.28)',
    bg: 'rgba(205,127,50,0.03)',
    icon: '♝',
    title: 'EXPERT',
    minH: 'min-h-[270px]',
  },
} as const

// ── helpers ─────────────────────────────────────────────────────────────────

const fmt = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

const winRate = (e: LeaderboardEntry) =>
  e.gamesPlayed === 0 ? '—' : `${Math.round((e.wins / e.gamesPlayed) * 100)}%`

// ── podium card (rank 1–3) ───────────────────────────────────────────────────

function PodiumCard({
  entry,
  isMe,
  delay,
}: {
  entry: LeaderboardEntry
  isMe: boolean
  delay: number
}) {
  const rank = entry.rank as 1 | 2 | 3
  const m = MEDAL[rank]
  const orderClass = rank === 2 ? 'order-1' : rank === 1 ? 'order-2' : 'order-3'

  return (
    <motion.div
      initial={{ opacity: 0, y: 48, scale: 0.86 }}
      animate={{ opacity: 1, y: 0, scale: rank === 1 ? 1.04 : 1 }}
      transition={{ delay, type: 'spring', damping: 18, stiffness: 180 }}
      className={`${orderClass} flex-1 min-w-0`}
    >
      <div
        className={`rounded-[28px] border p-6 flex flex-col items-center gap-3 relative overflow-hidden ${m.minH}`}
        style={{
          background: `linear-gradient(160deg, ${m.bg} 0%, rgba(0,0,0,0.55) 100%)`,
          borderColor: m.border,
          boxShadow: `0 0 60px ${m.glow}, 0 24px 60px rgba(0,0,0,0.55)`,
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* top ambient bloom */}
        <div
          className="absolute -top-10 left-1/2 -translate-x-1/2 w-28 h-28 rounded-full blur-3xl opacity-25 pointer-events-none"
          style={{ background: m.color }}
        />

        {/* inset top highlight for #1 */}
        {rank === 1 && (
          <div
            className="absolute inset-0 rounded-[28px] pointer-events-none"
            style={{ boxShadow: `inset 0 1px 0 ${m.color}35` }}
          />
        )}

        {/* Rank number */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: delay + 0.12, type: 'spring', damping: 14, stiffness: 200 }}
          className="text-[60px] font-black leading-none select-none"
          style={{
            fontFamily: 'var(--fd)',
            color: m.color,
            textShadow: `0 0 50px ${m.glow}`,
          }}
        >
          {rank}
        </motion.div>

        {/* Piece icon badge */}
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-xl border shrink-0"
          style={{
            borderColor: m.border,
            background: `${m.color}12`,
            color: m.color,
            boxShadow: `0 0 20px ${m.glow}`,
          }}
        >
          {m.icon}
        </div>

        {/* Title */}
        <div
          className="text-[9px] font-black tracking-[0.28em] uppercase"
          style={{ fontFamily: 'var(--fd)', color: m.color }}
        >
          {m.title}
        </div>

        {/* Address */}
        <div className="text-center">
          {isMe && (
            <div
              className="text-[8px] font-black tracking-widest uppercase mb-1"
              style={{ color: 'var(--c)', fontFamily: 'var(--fd)' }}
            >
              ⚡ YOU
            </div>
          )}
          <div
            className="font-bold text-xs tracking-wide truncate max-w-full"
            style={{ color: isMe ? 'var(--c)' : 'var(--t1)', fontFamily: 'var(--fb)' }}
          >
            {fmt(entry.address)}
          </div>
        </div>

        {/* ELO */}
        <div className="text-center mt-1">
          <div
            className="text-4xl font-black leading-none"
            style={{ fontFamily: 'var(--fd)', color: m.color }}
          >
            {entry.rating}
          </div>
          <div
            className="text-[8px] font-black tracking-[0.25em] uppercase mt-1"
            style={{ color: 'var(--t3)', fontFamily: 'var(--fd)' }}
          >
            ELO RATING
          </div>
        </div>

        {/* W / L / D */}
        <div className="flex w-full border-t border-white/5 pt-3 mt-auto">
          <div className="flex-1 text-center">
            <div
              className="text-base font-black text-green-400"
              style={{ fontFamily: 'var(--fd)' }}
            >
              {entry.wins}
            </div>
            <div className="text-[7px] text-gray-500 uppercase tracking-widest font-bold mt-0.5">WIN</div>
          </div>
          <div className="w-px bg-white/5" />
          <div className="flex-1 text-center">
            <div
              className="text-base font-black text-red-400"
              style={{ fontFamily: 'var(--fd)' }}
            >
              {entry.losses}
            </div>
            <div className="text-[7px] text-gray-500 uppercase tracking-widest font-bold mt-0.5">LOSS</div>
          </div>
          <div className="w-px bg-white/5" />
          <div className="flex-1 text-center">
            <div
              className="text-base font-black text-gray-400"
              style={{ fontFamily: 'var(--fd)' }}
            >
              {entry.draws}
            </div>
            <div className="text-[7px] text-gray-500 uppercase tracking-widest font-bold mt-0.5">DRAW</div>
          </div>
        </div>

        {/* Connected pulse dot */}
        {isMe && (
          <div
            className="absolute top-4 right-4 w-2 h-2 rounded-full animate-pulse"
            style={{ background: 'var(--c)' }}
          />
        )}
      </div>
    </motion.div>
  )
}

// ── rank row (4+) ────────────────────────────────────────────────────────────

function RankRow({
  entry,
  isMe,
  idx,
}: {
  entry: LeaderboardEntry
  isMe: boolean
  idx: number
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
      {/* Rank + address */}
      <div className="flex items-center gap-5 min-w-0">
        <span
          className="text-[11px] font-black tracking-widest w-8 shrink-0 text-right"
          style={{ fontFamily: 'var(--fd)', color: 'var(--t3)' }}
        >
          #{entry.rank}
        </span>
        <div className="flex flex-col min-w-0">
          {isMe && (
            <span
              className="text-[8px] font-black tracking-widest uppercase mb-0.5"
              style={{ color: 'var(--c)', fontFamily: 'var(--fd)' }}
            >
              YOU
            </span>
          )}
          <span
            className="font-bold text-sm tracking-wide truncate"
            style={{ color: isMe ? 'var(--c)' : 'var(--t1)', fontFamily: 'var(--fb)' }}
          >
            {fmt(entry.address)}
          </span>
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
  const { address } = useAccount()
  const { entries, isLoading, myRank, refresh } = useLeaderboard()

  const myAddress = address?.toLowerCase()
  const top3 = entries.slice(0, 3)
  const rest = entries.slice(3)
  const myEntry = myAddress ? entries.find((e) => e.address === myAddress) : null
  const myEntryNotInPodium = myEntry && (myEntry.rank ?? 0) > 3

  return (
    <main className="min-h-screen w-full bg-[var(--bg)] text-[var(--t1)] relative overflow-x-hidden flex flex-col">
      <Navbar />

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
            {address && myEntryNotInPodium && myEntry && myRank && (
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
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--c)] animate-pulse" />
                  <div>
                    <div
                      className="text-[8px] font-black tracking-[0.28em] uppercase mb-0.5"
                      style={{ fontFamily: 'var(--fd)', color: 'var(--t3)' }}
                    >
                      YOUR POSITION
                    </div>
                    <div
                      className="text-xl font-black"
                      style={{ fontFamily: 'var(--fd)', color: 'var(--c)' }}
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
              {/* ── Podium (top 3) ── */}
              {top3.length > 0 && (
                <div className="flex gap-3 md:gap-5 items-end">
                  {top3.map((entry, i) => (
                    <PodiumCard
                      key={entry.address}
                      entry={entry}
                      isMe={!!myAddress && entry.address === myAddress}
                      delay={0.1 + i * 0.09}
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
                  className="rounded-[32px] border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-2xl overflow-hidden"
                >
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
                      {rest.map((entry, idx) => (
                        <RankRow
                          key={entry.address}
                          entry={entry}
                          isMe={!!myAddress && entry.address === myAddress}
                          idx={idx}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
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
