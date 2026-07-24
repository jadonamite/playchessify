'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/components/wallet-provider'
import GlowButton from '@/components/ui/GlowButton'
import PlayCard from '@/components/ui/PlayCard'
import LoadingState from '@/components/ui/LoadingState'
import ChessName from '@/components/ui/ChessName'
import ChessAvatar from '@/components/ui/ChessAvatar'
import PageBackground from '@/components/ui/PageBackground'
import PodiumCard, { MEDAL } from '@/components/lobby/PodiumCard'
import { useTournament, type TournamentBoardEntry, type TournamentWindowMeta } from '@/hooks/useTournament'
import { useBatchProfiles } from '@/hooks/useBatchProfiles'

// ── helpers ───────────────────────────────────────────────────────────────────

const PLACE_TITLE: Record<number, string> = { 1: 'CHAMPION', 2: 'RUNNER-UP', 3: 'THIRD' }

function useCountdown(target: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const ms = Math.max(0, target - now)
  const s = Math.floor(ms / 1000)
  return {
    ended: ms === 0,
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

function fmtDate(ms: number) {
  return new Date(ms).toLocaleString('en-GB', {
    timeZone: 'Africa/Lagos',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── countdown strip ─────────────────────────────────────────────────────────

function Countdown({ endsAt }: { endsAt: number }) {
  const c = useCountdown(endsAt)
  const cell = (v: string, label: string) => (
    <div className="flex flex-col items-center">
      <span
        className="font-black tabular-nums leading-none text-2xl sm:text-3xl"
        style={{ fontFamily: 'var(--fd)', color: 'var(--c)', textShadow: '0 0 18px rgba(0,204,255,0.4)' }}
      >
        {v}
      </span>
      <span className="text-[8px] font-black tracking-[0.2em] uppercase mt-1 text-[var(--t3)]">{label}</span>
    </div>
  )
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      {c.d > 0 && (
        <>
          {cell(String(c.d), 'days')}
          <span className="text-xl font-black text-[var(--t3)] -mt-3">:</span>
        </>
      )}
      {cell(pad(c.h), 'hrs')}
      <span className="text-xl font-black text-[var(--t3)] -mt-3">:</span>
      {cell(pad(c.m), 'min')}
      <span className="text-xl font-black text-[var(--t3)] -mt-3">:</span>
      {cell(pad(c.s), 'sec')}
    </div>
  )
}

// ── prize pool card (chrome bracket, metallic split rows) ─────────────────────

function PrizeCard({ win }: { win: TournamentWindowMeta }) {
  return (
    <div
      className="relative rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(12,18,32,0.85), rgba(4,7,14,0.9))',
        border: '1px solid var(--b2)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 20px 50px rgba(0,0,0,0.45)',
      }}
    >
      {/* total pool */}
      <div className="flex flex-col shrink-0">
        <span className="text-[9px] font-black tracking-[0.25em] uppercase text-[var(--t3)] flex items-center gap-1.5">
          🏆 Total Prize
        </span>
        <span
          className="font-black leading-none mt-1"
          style={{
            fontFamily: 'var(--fd)',
            fontSize: 44,
            backgroundImage: `linear-gradient(180deg, #FFF6C2, #FFD24A 55%, #9C6B12)`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 22px rgba(255,215,0,0.35))',
          }}
        >
          ${win.prizePool}
        </span>
      </div>

      {/* divider */}
      <div className="hidden sm:block w-px self-stretch bg-white/10" />

      {/* splits */}
      <div className="flex-1 grid grid-cols-3 gap-3">
        {win.splits.map((s) => {
          const m = MEDAL[(s.place as 1 | 2 | 3)] ?? MEDAL[3]
          return (
            <div
              key={s.place}
              className="rounded-xl px-3 py-2.5 flex flex-col items-center gap-0.5"
              style={{ background: m.bg, border: `1px solid ${m.border}`, boxShadow: `inset 0 1px 0 ${m.color}22` }}
            >
              <span className="text-[8px] font-black tracking-[0.15em] uppercase" style={{ color: m.color }}>
                {s.place === 1 ? '1ST' : s.place === 2 ? '2ND' : '3RD'}
              </span>
              <span
                className="font-black leading-none"
                style={{
                  fontFamily: 'var(--fd)',
                  fontSize: 22,
                  backgroundImage: `linear-gradient(180deg, ${m.mLight}, ${m.mMid} 50%, ${m.mDeep})`,
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                ${s.amount}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── tournament rank row (4+) ──────────────────────────────────────────────────

function TrophyRow({
  entry,
  isMe,
  idx,
  profileMap,
}: {
  entry: TournamentBoardEntry
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
            <span className="text-[8px] font-black tracking-widest uppercase mb-0.5" style={{ color: 'var(--c)', fontFamily: 'var(--fd)' }}>
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
          {!entry.eligible && (
            <span className="text-[8px] font-bold tracking-wide text-[var(--t3)] mt-0.5">
              {entry.games}/3 games to qualify
            </span>
          )}
        </div>
      </div>

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
        <div className="flex flex-col items-end">
          <span className="text-[8px] text-gray-500 uppercase tracking-widest font-bold mb-0.5">XP</span>
          <span className="text-base font-black" style={{ fontFamily: 'var(--fd)', color: 'var(--candy-amber)' }}>
            {entry.xp}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function TournamentContent() {
  const router = useRouter()
  const { playerAddress } = useWallet()
  const { data, isLoading, refresh } = useTournament()
  const board = data?.board ?? []
  const { data: profileMap = {} } = useBatchProfiles(board.map((e) => e.address))

  const myAddress = playerAddress?.toLowerCase()
  const win = data?.window
  const winnerAmount = (addr: string) => data?.winners.find((w) => w.address === addr)?.amount

  const top3 = board.slice(0, 3)
  const podium = ([2, 1, 3] as const)
    .map((r) => top3.find((e) => e.rank === r))
    .filter((e): e is TournamentBoardEntry => Boolean(e))
  const rest = board.slice(3)
  const myEntry = myAddress ? board.find((e) => e.address === myAddress) : null
  const myEntryNotInPodium = myEntry && myEntry.rank > 3

  return (
    <main className="min-h-screen w-full bg-[var(--bg)] text-[var(--t1)] relative overflow-x-hidden flex flex-col">
      <PageBackground hero="king" />

      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[8%] right-[8%] w-[32%] h-[32%] bg-[#FFD700] blur-[150px] rounded-full opacity-[0.04]" />
        <div className="absolute bottom-[12%] left-[6%] w-[28%] h-[28%] bg-[var(--c)] blur-[130px] rounded-full opacity-[0.05]" />
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
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-8">

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
                className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none"
                style={{ fontFamily: 'var(--fd)', textShadow: 'var(--hero-text-shadow)' }}
              >
                GRAND{' '}
                <span style={{ color: 'var(--c)', textShadow: 'var(--king-text-shadow)' }}>
                  PRIX
                </span>{' '}
                <span style={{ color: 'var(--candy-amber)' }}>{win?.id ?? 'S1'}</span>
              </h1>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-black/40 py-1.5 px-3 rounded-full border border-white/10 shadow-inner">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--c)] animate-pulse" />
                  <span className="text-[10px] tracking-[0.2em] font-bold text-[var(--c)]" style={{ fontFamily: 'var(--fd)' }}>
                    CELO
                  </span>
                </div>
                <span className="text-[10px] font-bold tracking-[0.2em] text-[var(--t3)] uppercase">
                  WEEKLY · VERIFIED ON-CHAIN
                </span>
              </div>
            </motion.div>
          </div>

          {/* ── Prize pool + countdown ── */}
          {win && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col gap-4"
            >
              <PrizeCard win={win} />
              <div
                className="rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 backdrop-blur-sm"
                style={{ background: 'var(--b1)', border: '1px solid var(--b2)' }}
              >
                <span className="text-[10px] font-black tracking-[0.2em] uppercase text-[var(--t3)]">
                  ⏳ Season ends {fmtDate(win.endsAt)}
                </span>
                <Countdown endsAt={win.endsAt} />
              </div>
            </motion.div>
          )}

          {/* ── My tournament position ── */}
          <AnimatePresence>
            {myEntry && myEntryNotInPodium && (
              <motion.div
                key="my-trophy-banner"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: 0.14 }}
                className="rounded-2xl border border-[var(--b2)] px-6 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between backdrop-blur-sm"
                style={{ background: 'var(--b1)' }}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--c)] animate-pulse shrink-0" />
                  <ChessAvatar address={myEntry.address} size={36} />
                  <div className="min-w-0">
                    <div className="text-[8px] font-black tracking-[0.28em] uppercase mb-0.5" style={{ fontFamily: 'var(--fd)', color: 'var(--t3)' }}>
                      YOUR STANDING
                    </div>
                    <ChessName
                      address={myEntry.address}
                      profile={profileMap[myEntry.address.toLowerCase()]}
                      short
                      asLink
                      badge
                      className="font-bold text-sm tracking-wide truncate max-w-full"
                      style={{ color: 'var(--c)' }}
                    />
                    <div className="text-lg font-black mt-0.5" style={{ fontFamily: 'var(--fd)', color: 'var(--t1)' }}>
                      RANK #{myEntry.rank}
                    </div>
                  </div>
                </div>
                <div className="flex w-full justify-between sm:w-auto sm:justify-end gap-4 sm:gap-6 text-right">
                  <div>
                    <div className="text-[8px] text-gray-500 uppercase font-bold tracking-widest mb-0.5">XP</div>
                    <div className="text-lg font-black" style={{ fontFamily: 'var(--fd)', color: 'var(--candy-amber)' }}>
                      {myEntry.xp}
                    </div>
                  </div>
                  <div>
                    <div className="text-[8px] text-gray-500 uppercase font-bold tracking-widest mb-0.5">GAMES</div>
                    <div className="text-lg font-black text-white" style={{ fontFamily: 'var(--fd)' }}>
                      {myEntry.games}
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
              <LoadingState message="LOADING TOURNAMENT" />
            </div>
          ) : board.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-32 text-center flex flex-col items-center gap-5">
              <div className="text-5xl opacity-40">🏆</div>
              <p className="text-sm font-bold tracking-widest text-[var(--t3)] uppercase">
                No games played this season yet
              </p>
              <p className="text-xs text-[var(--t3)] max-w-sm">
                Win ranked games this week to climb the board. Beating higher-rated players earns more XP.
              </p>
              <GlowButton variant="brand" size="sm" parallelogram onClick={() => router.push('/app/lobby')}>
                PLAY A RANKED MATCH
              </GlowButton>
            </motion.div>
          ) : (
            <>
              {/* Podium (top 3) */}
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
                      hero={entry.xp}
                      heroLabel="XP"
                      wins={entry.wins}
                      losses={entry.losses}
                      draws={entry.draws}
                      title={PLACE_TITLE[entry.rank]}
                      prize={winnerAmount(entry.address) != null ? `$${winnerAmount(entry.address)}` : undefined}
                    />
                  ))}
                </div>
              )}

              {/* Ranks 4+ */}
              {rest.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32, ease: [0.16, 1, 0.3, 1] }}>
                  <PlayCard size='hero'>
                    <div className="px-6 md:px-8 py-4 border-b border-white/5 flex items-center justify-between">
                      <span className="text-[10px] font-black tracking-[0.25em] text-[var(--t3)] uppercase" style={{ fontFamily: 'var(--fd)' }}>
                        Challengers
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
                          <TrophyRow
                            key={entry.address}
                            entry={entry}
                            isMe={!!myAddress && entry.address === myAddress}
                            idx={idx}
                            profileMap={profileMap}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  </PlayCard>
                </motion.div>
              )}

              {/* How XP works */}
              <div className="rounded-2xl px-6 py-5 backdrop-blur-sm" style={{ background: 'var(--b1)', border: '1px solid var(--b2)' }}>
                <span className="text-[10px] font-black tracking-[0.2em] uppercase text-[var(--t3)]">How XP works</span>
                <p className="text-xs text-[var(--t2)] mt-2 leading-relaxed">
                  Everyone starts each season at <span className="font-bold text-[var(--t1)]">0 XP</span>. Every ranked
                  game this week earns XP — a <span className="text-green-400 font-bold">win</span> is worth the most, a{' '}
                  <span className="text-gray-300 font-bold">draw</span> less. Beating a{' '}
                  <span className="font-bold text-[var(--candy-amber)]">higher-rated</span> player is worth up to 2×,
                  while grinding much weaker opponents is worth less. Play at least{' '}
                  <span className="font-bold text-[var(--t1)]">3 games</span> to qualify for a prize. Whoever tops the
                  board when the timer hits zero takes the pot.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
