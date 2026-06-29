'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWallet } from '@/components/wallet-provider'
import GlowButton from '@/components/ui/GlowButton'
import ClayCard from '@/components/ui/ClayCard'
import PlayCard from '@/components/ui/PlayCard'
import ComingSoonOverlay from '@/components/ui/ComingSoonOverlay'
import { useRouter } from 'next/navigation'
import { CELO_CONTRACTS, TOKEN_DECIMALS, CELO_CHAIN_ID } from '@/config/contracts'
import { useCeloChess } from '@/hooks/useCeloChess'
import { useLobby } from '@/hooks/useLobby'
import { useBatchProfiles } from '@/hooks/useBatchProfiles'
import { useProfile } from '@/hooks/useProfile'
import { useStreak, dispatchStreak, STREAK_NUDGE_KEY, streakDay } from '@/hooks/useStreak'
import ChessName from '@/components/ui/ChessName'
import ChessAvatar from '@/components/ui/ChessAvatar'
import PageBackground from '@/components/ui/PageBackground'
import ClaimModal from '@/components/ui/ClaimModal'
import LoadingState from '@/components/ui/LoadingState'
import { CrownIcon, RankIcon, FlameIcon } from '@/components/ui/icons'
import { useReadContract } from 'wagmi'
import { CHESS_GAME_ABI, CHESS_TOKEN_ABI } from '@/config/abis'
import { formatUnits } from 'viem'
function BgIcon({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'absolute',
      bottom: '-8%',
      right: '-4%',
      height: '80%',
      aspectRatio: '1',
      opacity: 0.04,
      pointerEvents: 'none',
      transition: 'opacity .3s',
      overflow: 'hidden',
      zIndex: 0,
    }}>
      {children}
    </div>
  )
}

export default function LobbyContent() {
  const { isConnected, isReady, playerAddress } = useWallet()
  const { createGame: createCeloGame } = useCeloChess()
  const router = useRouter()

  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false)
  const MAINTENANCE_MODE = false

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchId, setSearchId] = useState('')
  const ITEMS_PER_PAGE = 3
  const [wager, setWager] = useState(100)
  const [balance, setBalance] = useState<string>('0.00')
  const [rating, setRating] = useState<number>(1200)
  const [wins, setWins] = useState(0)
  const [losses, setLosses] = useState(0)
  const [draws, setDraws] = useState(0)

  // Balance/stats are keyed to the on-chain player identity (the smart account for
  // Tier A, otherwise the connected EOA) — the same identity the game contract sees.
  const {
    data: celoBalance,
    isPending: isBalanceLoading,
    isRefetching,
    refetch: refetchBalance,
  } = useReadContract({
    address: CELO_CONTRACTS.token as `0x${string}`,
    abi: CHESS_TOKEN_ABI,
    functionName: 'balanceOf',
    args: [playerAddress as `0x${string}`],
    chainId: CELO_CHAIN_ID,
    query: { enabled: !!playerAddress, refetchInterval: 5000, staleTime: 0 }
  })
  const isBalanceUpdating = isBalanceLoading || isRefetching

  const { data: celoStats } = useReadContract({
    address: CELO_CONTRACTS.game as `0x${string}`,
    abi: CHESS_GAME_ABI,
    functionName: 'playerStats',
    args: [playerAddress as `0x${string}`],
    chainId: CELO_CHAIN_ID,
    query: { enabled: !!playerAddress }
  })

  useEffect(() => {
    if (playerAddress) {
      if (celoBalance !== undefined) setBalance(formatUnits(celoBalance as bigint, TOKEN_DECIMALS))
      if (celoStats) {
        const s = celoStats as readonly bigint[]
        setRating(Number(s[3]))
        setWins(Number(s[0]))
        setLosses(Number(s[1]))
        setDraws(Number(s[2]))
      }
    }
  }, [playerAddress, celoBalance, celoStats])

  const { games: openGames, isLoading: isLobbyLoading, refresh: refreshLobby } = useLobby()
  const { data: lobbyProfileMap = {} } = useBatchProfiles(openGames.map((g) => g.creator))

  const { data: myProfile } = useProfile(playerAddress ?? null)
  const { streak, isLoading: streakLoading } = useStreak(playerAddress)

  // Daily nudge — a 0-streak player who lands on the lobby gets the motivational
  // streak prompt. Strictly once per UTC day: we skip the dispatch outright if
  // it's already been shown today, so navigating away and back won't re-fire it.
  const nudgeFired = useRef(false)
  useEffect(() => {
    if (nudgeFired.current) return
    if (!playerAddress || streakLoading || streak.current > 0) return
    nudgeFired.current = true
    try {
      if (localStorage.getItem(STREAK_NUDGE_KEY) === streakDay()) return
    } catch { /* storage blocked — fall through and let the overlay guard */ }
    dispatchStreak({ mode: 'nudge', current: 0, longest: streak.longest })
  }, [playerAddress, streakLoading, streak.current, streak.longest])
  const [claimModalOpen, setClaimModalOpen] = useState(false)
  const showClaimBanner = isConnected && !!playerAddress && myProfile === null

  const handleCreateGame = async () => {
    if (MAINTENANCE_MODE) return setIsComingSoonOpen(true)
    setIsPending(true)
    setCreateError(null)
    try {
      const gameId = await createCeloGame(wager)
      setIsCreateModalOpen(false)
      if (gameId !== null) {
        router.push(`/app/game/${gameId}`)
      } else {
        refreshLobby()
      }
    } catch (err) {
      const msg = (err instanceof Error ? err.message : '').includes('cancelled')
        ? 'Transaction cancelled.'
        : 'Failed to create game. Check your balance and try again.'
      setCreateError(msg)
    } finally {
      setIsPending(false)
    }
  }


  const handleSearchJoin = () => {
    setSearchError(null)
    const id = parseInt(searchId, 10)
    if (!searchId || isNaN(id) || id <= 0) {
      setSearchError('Enter a valid numeric match ID.')
      return
    }
    // Navigate to the game page — it will handle join/spectate logic based on game state
    router.push(`/app/game/${id}`)
  }

  const handleAction = (action: () => void) => MAINTENANCE_MODE ? setIsComingSoonOpen(true) : action()

  useEffect(() => {
    if (!isConnected) {
      router.replace('/')
    }
  }, [isConnected, router])

  // Not authenticated — redirect to landing
  if (!isConnected) {
    return <main className="min-h-screen w-full bg-[var(--bg)]" />
  }

  // Authenticated but wallet still being provisioned
  if (!isReady || !playerAddress) {
    return (
      <main className="min-h-screen w-full bg-[var(--bg)] flex items-center justify-center">
        <LoadingState message="SETTING UP WALLET" />
      </main>
    )
  }

  return (
    <main className="min-h-screen w-full max-w-[100vw] bg-[var(--bg)] text-[var(--t1)] relative flex flex-col box-border overflow-x-hidden">

      {/* Static Background */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-50 bg-[var(--bg)]" />

      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px)', backgroundSize: '52px 52px', pointerEvents: 'none', zIndex: 0, opacity: 0.4 }} />

      <PageBackground hero="king" grid={false} />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-full box-border px-4 md:px-8 py-6 md:py-10">

        {/* ── .chess onboarding banner ── */}
        {showClaimBanner && playerAddress && (
          <div className="w-full max-w-7xl mx-auto mb-6">
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--c)]/20 px-5 py-4"
              style={{ background: 'linear-gradient(90deg,rgba(0,204,255,0.06) 0%,rgba(6,6,15,0.7) 100%)' }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-lg shrink-0">✦</span>
                <div className="min-w-0">
                  <p className="text-xs font-black tracking-wide text-white">Claim your <span style={{ color: 'var(--c)' }}>.chess</span> name</p>
                  <p className="text-[10px] text-[var(--t3)] truncate">Stand out on the leaderboard with a permanent identity.</p>
                </div>
              </div>
              <GlowButton
                variant="brand"
                size="sm"
                parallelogram
                className="shrink-0"
                onClick={() => setClaimModalOpen(true)}
              >
                CLAIM
              </GlowButton>
            </motion.div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6 items-start w-full max-w-7xl mx-auto box-border">

          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-8 flex flex-col gap-5 md:gap-6 w-full min-w-0 box-border">

            {/*
              FIX: Shell/content split.
              The outer div owns ALL visual properties that create a stacking context:
              backdrop-blur, background, border, border-radius, shadow.
              The inner div owns ALL spacing: padding.
              This prevents backdrop-blur from interfering with padding compositing.
            */}

            {/* ── CARD 1: Game Lobby Header ── */}
            <PlayCard size="hero">
              {/* candy glow wash behind the hero */}
              <div
                className="absolute -top-1/3 -right-1/4 w-2/3 aspect-square rounded-full pointer-events-none z-0"
                style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--c) 22%, transparent) 0%, transparent 70%)', filter: 'blur(8px)' }}
              />
              <div className="p-5 md:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">

                {/* Emblem + heading — stacks until desktop so the CTAs never collide */}
                <div className="flex flex-col items-center lg:items-start gap-5 text-center lg:text-left">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.6, rotate: -12 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    whileHover={{ rotate: -7, scale: 1.06 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 16 }}
                    className="relative shrink-0 cursor-pointer"
                    aria-hidden
                  >
                    {/* Glossy claymorphic orb */}
                    <div
                      className="flex items-center justify-center rounded-[28px]"
                      style={{
                        width: 84,
                        height: 84,
                        color: '#001a22',
                        background: 'var(--btn-face)',
                        boxShadow: 'var(--btn-shadow)',
                      }}
                    >
                      <CrownIcon size={42} />
                    </div>
                    {/* top-edge specular highlight */}
                    <div className="absolute inset-x-3 top-1.5 h-4 rounded-full pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.7), transparent)', opacity: 0.55 }} />
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 items-center lg:items-start">
                    <h1
                      className="font-black uppercase tracking-tighter leading-none"
                      style={{ fontFamily: 'var(--fd)', textShadow: 'var(--hero-text-shadow)', fontSize: 'clamp(2.1rem, 4.5vw, 3.25rem)' }}
                    >
                      Game{' '}
                      <span style={{ color: 'var(--c)', textShadow: 'var(--king-text-shadow)' }}>
                        Lobby
                      </span>
                    </h1>

                    {/* Stat chips — mobile only (desktop shows the right-rail cards instead) */}
                    <div className="lg:hidden grid grid-cols-2 gap-2.5 w-full max-w-xs">
                      <div
                        className="flex flex-col gap-1 px-4 py-3 rounded-2xl border"
                        style={{ background: 'color-mix(in srgb, var(--candy-lime) 12%, transparent)', borderColor: 'color-mix(in srgb, var(--candy-lime) 28%, transparent)' }}
                      >
                        <span className="text-[9px] tracking-[0.18em] uppercase font-bold" style={{ fontFamily: 'var(--fd)', color: 'var(--candy-lime)' }}>Balance</span>
                        <span className="text-xl leading-none font-black text-white" style={{ fontFamily: 'var(--fd)' }}>{balance}<span className="text-[10px] ml-1" style={{ color: 'var(--candy-lime)' }}>CHESS</span></span>
                      </div>
                      <div
                        className="flex flex-col gap-1 px-4 py-3 rounded-2xl border"
                        style={{ background: 'color-mix(in srgb, var(--candy-amber) 12%, transparent)', borderColor: 'color-mix(in srgb, var(--candy-amber) 28%, transparent)' }}
                      >
                        <span className="text-[9px] tracking-[0.18em] uppercase font-bold" style={{ fontFamily: 'var(--fd)', color: 'var(--candy-amber)' }}>Rating</span>
                        <span className="text-xl leading-none font-black text-white" style={{ fontFamily: 'var(--fd)' }}>{rating}<span className="text-[10px] ml-1" style={{ color: 'var(--candy-amber)' }}>ELO</span></span>
                      </div>
                      {streak.current > 0 && (
                        <div
                          className="col-span-2 flex items-center justify-between px-4 py-3 rounded-2xl border"
                          style={{ background: 'rgba(255,138,61,0.1)', borderColor: '#ff8a3d55' }}
                        >
                          <span className="flex items-center gap-2 text-[9px] tracking-[0.18em] uppercase font-bold" style={{ fontFamily: 'var(--fd)', color: '#ff8a3d' }}>
                            <FlameIcon size={14} /> Daily Streak
                          </span>
                          <span className="text-xl leading-none font-black" style={{ fontFamily: 'var(--fd)', color: '#ff8a3d' }}>
                            {streak.current}<span className="text-[10px] ml-1">DAYS</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>

                {/* CTAs — trapezoid brand buttons preserved, full-width on mobile */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="shrink-0 flex flex-col gap-3 w-full lg:w-auto"
                >
                  <GlowButton
                    parallelogram
                    variant="brand"
                    size="lg"
                    onClick={() => handleAction(() => setIsCreateModalOpen(true))}
                    className="w-full"
                  >
                    CREATE NEW MATCH
                  </GlowButton>
                  <GlowButton
                    parallelogram
                    variant="ghost"
                    size="lg"
                    onClick={() => router.push('/app/game/bot')}
                    className="w-full"
                  >
                    QUICK PLAY (VS AI)
                  </GlowButton>
                </motion.div>
              </div>
            </PlayCard>

            {/* ── CARD 2: Open Challenges ── */}
            <PlayCard size="hero">
              <BgIcon>
                <svg viewBox="0 0 24 24" fill="none" width="100%" height="100%">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.2" />
                  <line x1="12" y1="12" x2="17.5" y2="8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </BgIcon>
              <div className="p-5 md:p-7 flex flex-col gap-5 relative z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
                  <div className="flex items-center gap-3">
                    <h3
                      className="text-xs font-bold tracking-[0.25em] text-[var(--t3)] uppercase"
                      style={{ fontFamily: 'var(--fd)' }}
                    >
                      Open Challenges
                    </h3>
                    {isLobbyLoading && (
                      <div className="w-3 h-3 border-2 border-[var(--c)] border-t-transparent rounded-full animate-spin opacity-60" />
                    )}
                  </div>
                  
                  {/* Search / Join by ID */}
                  <div className="flex flex-col gap-1 w-full md:w-auto md:min-w-[280px]">
                    <div className="flex items-stretch gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="ENTER MATCH ID…"
                        value={searchId}
                        onChange={(e) => { setSearchId(e.target.value); setSearchError(null) }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchJoin()}
                        className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs tracking-widest uppercase font-bold text-white placeholder:text-white/25 focus:outline-none focus:border-[var(--c)]/60 focus:bg-black/60 transition-colors"
                      />
                      <GlowButton
                        variant="brand"
                        onClick={handleSearchJoin}
                        disabled={!searchId}
                        className="shrink-0"
                      >
                        GO
                      </GlowButton>
                    </div>
                    {searchError && (
                      <span className="text-[9px] text-red-400 font-bold tracking-widest uppercase">{searchError}</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {isLobbyLoading && openGames.length === 0 ? (
                    <LoadingState message="SCANNING LOBBY" />
                  ) : openGames.length === 0 ? (
                    <div className="py-20 text-center flex flex-col items-center gap-4 border border-white/5 bg-white/[0.02] rounded-3xl">
                      <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center opacity-40">
                         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                           <path d="M12 8V12L15 15" />
                           <circle cx="12" cy="12" r="9" />
                         </svg>
                      </div>
                      <p className="text-sm font-bold tracking-widest text-[var(--t3)]">NO CHALLENGES FOUND</p>
                      <GlowButton variant="ghost" size="sm" onClick={() => setIsCreateModalOpen(true)}>BE THE FIRST</GlowButton>
                    </div>
                  ) : (
                    <>
                      {openGames.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((game, idx) => (
                    <motion.div
                      key={game.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      whileTap={{ scale: 0.985 }}
                    >
                      {/*
                        Challenge row: also split — outer for visual chrome,
                        inner for padding. Keeps hover states clean.
                      */}
                      <div className="rounded-2xl border border-white/5 bg-black/40 hover:bg-black/60 hover:border-white/10 transition-colors active:border-[var(--c)]/30">
                        <div className="p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 md:gap-5">

                          <div className="flex items-center gap-3.5 w-full sm:w-auto min-w-0">
                            <div className="w-12 h-12 shrink-0 rounded-xl flex flex-col items-center justify-center font-bold text-cyan-400 bg-cyan-950/30 border border-cyan-500/20">
                              <span className="text-[8px] uppercase tracking-widest opacity-60">ELO</span>
                              <span className="text-sm leading-none mt-1">{game.elo}</span>
                            </div>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <ChessAvatar address={game.creator} size={28} />
                              <div className="flex flex-col justify-center min-w-0">
                                <span
                                  className="text-[10px] tracking-[0.2em] text-gray-500 uppercase font-bold mb-1"
                                  style={{ fontFamily: 'var(--fd)' }}
                                >
                                  CHALLENGER
                                </span>
                                <ChessName
                                  address={game.creator}
                                  profile={lobbyProfileMap[game.creator.toLowerCase()]}
                                  asLink
                                  className="font-bold tracking-wide text-sm text-gray-200 truncate max-w-full"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between w-full sm:w-auto sm:gap-5 border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0 shrink-0">
                            <div className="flex flex-col justify-center sm:text-right">
                              <span
                                className="text-[9px] tracking-[0.2em] text-gray-500 uppercase font-bold mb-0.5"
                                style={{ fontFamily: 'var(--fd)' }}
                              >
                                WAGER
                              </span>
                              <div className="font-black text-cyan-400 text-base leading-none">
                                {game.wager}{' '}
                                <span className="text-[9px] text-cyan-700">CHESS</span>
                              </div>
                            </div>
                            <GlowButton
                              size="sm"
                              onClick={() => handleAction(() => router.push(`/app/game/${game.id}`))}
                              className="min-w-[100px] shrink-0"
                            >
                              JOIN MATCH
                            </GlowButton>
                          </div>

                        </div>
                      </div>
                    </motion.div>
                      ))}

                      {/* Pagination UI */}
                      {openGames.length > ITEMS_PER_PAGE && (
                        <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-white/5">
                          <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-[10px] tracking-widest uppercase font-black text-white hover:bg-black/60 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          >
                            PREV
                          </button>
                          <span className="text-[10px] font-black text-[var(--c)] tracking-widest uppercase">
                            PAGE {currentPage} / {Math.ceil(openGames.length / ITEMS_PER_PAGE)}
                          </span>
                          <button 
                            onClick={() => setCurrentPage(p => Math.min(Math.ceil(openGames.length / ITEMS_PER_PAGE), p + 1))}
                            disabled={currentPage === Math.ceil(openGames.length / ITEMS_PER_PAGE)}
                            className="bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-[10px] tracking-widest uppercase font-black text-white hover:bg-black/60 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          >
                            NEXT
                          </button>
                        </div>
                      )}

                      {openGames.length === 0 && (
                        <div className="py-20 text-center border border-dashed border-white/10 rounded-2xl bg-black/40">
                          <p className="text-sm font-medium text-gray-500 tracking-wider">
                            NO OPEN MATCHES ON CELO
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </PlayCard>

          </div>

          {/* ── RIGHT COLUMN (widget rail) — desktop only; mobile uses the hero chips ── */}
          <div className="hidden lg:flex lg:col-span-4 flex-col gap-5 md:gap-6 h-auto w-full min-w-0 box-border">

            {/* ── CARD: CHESS balance ── */}
            <PlayCard size="rail" tone="candy" accent="var(--candy-lime)">
              <div className="p-6 md:p-7 flex flex-col gap-4 relative z-10">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ fontFamily: 'var(--fd)', color: 'var(--candy-lime)' }}>
                    Balance
                  </h3>
                  <button
                    onClick={() => refetchBalance()}
                    aria-label="Refresh balance"
                    title="Refresh balance"
                    className="p-1.5 rounded-full border border-white/10 bg-black/30 text-[var(--candy-lime)] hover:bg-black/50 hover:border-white/20 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" className={isBalanceUpdating ? 'animate-spin' : ''}>
                      <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[44px] font-black text-white leading-none" style={{ fontFamily: 'var(--fd)' }}>{balance}</span>
                  <span className="text-xs font-bold tracking-widest" style={{ color: 'var(--candy-lime)' }}>CHESS</span>
                </div>
              </div>
            </PlayCard>

            {/* ── CARD: Rating + rank (league-style) ── */}
            <PlayCard size="rail" tone="candy" accent="var(--candy-amber)">
              <div className="absolute -top-1/4 -right-1/4 w-2/3 aspect-square rounded-full pointer-events-none z-0" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--candy-amber) 18%, transparent) 0%, transparent 70%)' }} />
              <div className="p-6 md:p-7 flex flex-col gap-4 relative z-10">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ fontFamily: 'var(--fd)', color: 'var(--candy-amber)' }}>
                    Your Rating
                  </h3>
                  <button onClick={() => router.push('/app/leaderboard')} className="text-[10px] font-black tracking-widest uppercase text-[var(--candy-amber)] hover:opacity-80 transition-opacity">
                    VIEW RANKS →
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center rounded-2xl shrink-0" style={{ width: 52, height: 52, background: 'color-mix(in srgb, var(--candy-amber) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--candy-amber) 30%, transparent)', color: 'var(--candy-amber)' }}>
                    <RankIcon size={28} />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-black text-white leading-none" style={{ fontFamily: 'var(--fd)' }}>{rating}</span>
                    <span className="text-[11px] font-bold tracking-widest" style={{ color: 'var(--candy-amber)' }}>ELO</span>
                  </div>
                </div>
              </div>
            </PlayCard>

            {/* ── CARD: Daily streak (shown once a streak is live) ── */}
            {streak.current > 0 && (
              <PlayCard size="rail" tone="candy" accent="#ff8a3d">
                <div className="p-6 md:p-7 flex items-center justify-between gap-4 relative z-10">
                  <div className="flex flex-col gap-1">
                    <h3 className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] uppercase" style={{ fontFamily: 'var(--fd)', color: '#ff8a3d' }}>
                      <FlameIcon size={15} /> Daily Streak
                    </h3>
                    <span className="text-[10px] text-[var(--t3)]">Longest: {streak.longest}d</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[44px] font-black leading-none" style={{ fontFamily: 'var(--fd)', color: '#ff8a3d', textShadow: '0 0 30px #ff8a3d66' }}>{streak.current}</span>
                    <span className="text-xs font-bold tracking-widest" style={{ color: '#ff8a3d' }}>DAYS</span>
                  </div>
                </div>
              </PlayCard>
            )}

            {/* ── CARD: Record (W / D / L) ── */}
            <PlayCard size="rail" tone="candy" accent="var(--candy-grape)">
              <div className="p-6 md:p-7 flex flex-col gap-4 relative z-10">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ fontFamily: 'var(--fd)', color: 'var(--candy-grape)' }}>
                    Record
                  </h3>
                  <button onClick={() => handleAction(() => router.push('/app/history'))} className="text-[10px] font-black tracking-widest uppercase text-[var(--candy-grape)] hover:opacity-80 transition-opacity">
                    HISTORY →
                  </button>
                </div>
                <div className="flex items-stretch gap-2">
                  {[
                    { label: 'Wins', value: wins, color: 'var(--candy-lime)' },
                    { label: 'Draws', value: draws, color: 'var(--t2)' },
                    { label: 'Losses', value: losses, color: 'var(--candy-rose)' },
                  ].map((s) => (
                    <div key={s.label} className="flex-1 flex flex-col items-center gap-1.5 rounded-2xl py-3.5 bg-black/30 border border-white/5">
                      <span className="text-2xl font-black leading-none" style={{ fontFamily: 'var(--fd)', color: s.color }}>{s.value}</span>
                      <span className="text-[9px] font-bold tracking-[0.15em] uppercase text-gray-500">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </PlayCard>

            {/* ── CARD: Need CHESS? (promo) ── */}
            <PlayCard size="rail" tone="candy" accent="var(--c)">
              <BgIcon>
                <svg viewBox="0 0 24 24" fill="none" width="100%" height="100%">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </BgIcon>
              <div className="p-6 md:p-7 flex flex-col gap-3 relative z-10">
                <h4 className="font-bold text-[14px] tracking-widest text-white uppercase" style={{ fontFamily: 'var(--fd)' }}>
                  Need CHESS?
                </h4>
                <p className="text-[13px] text-gray-400 leading-relaxed">
                  Claim free testnet tokens to start playing on Celo.
                </p>
                <div className="mt-3 w-full">
                  <GlowButton variant="brand" fullWidth onClick={() => handleAction(() => router.push('/app/faucet'))}>
                    VISIT FAUCET
                  </GlowButton>
                </div>
              </div>
            </PlayCard>

          </div>
        </div>
      </div>

      {/* ── CREATE MATCH MODAL ── */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="m-sheet-wrap fixed inset-0 z-50 flex items-center justify-center p-6 box-border">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="m-sheet relative w-full max-w-md box-border"
            >
              {/*
                ClayCard already manages its own shell correctly.
                The inner padding div keeps content away from the blur boundary.
              */}
              <ClayCard className="overflow-hidden border border-white/10 bg-slate-950/90 backdrop-blur-2xl shadow-[0_24px_60px_rgba(0,0,0,0.8)] rounded-[32px]">
                <div className="p-6 sm:p-8 md:p-10 relative">
                  {/* Close button */}
                  {!isPending && (
                    <button
                      onClick={() => setIsCreateModalOpen(false)}
                      className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors text-xl font-bold cursor-pointer"
                    >
                      ×
                    </button>
                  )}

                  {isPending ? (
                    /* Confirmation / Loading State */
                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                      <div className="relative mb-8">
                        <div className="w-20 h-20 rounded-full border-4 border-cyan-500/10 border-t-cyan-400 animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg className="w-8 h-8 text-cyan-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                      </div>
                      <h4 className="text-xl font-black uppercase tracking-wider text-white mb-3" style={{ fontFamily: 'var(--fd)' }}>
                        Confirm in Wallet
                      </h4>
                      <p className="text-xs text-gray-400 max-w-xs leading-relaxed mb-2">
                        Please approve the spend limit and confirm the transaction in your connected wallet.
                      </p>
                      <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest animate-pulse">
                        Step 1: Approve Limit &rarr; Step 2: Initialize Game
                      </p>
                    </div>
                  ) : (
                    /* Wager Selection UI */
                    <>
                      <div className="flex justify-between items-baseline mb-6">
                        <h3 className="text-2xl font-black uppercase tracking-tight text-white" style={{ fontFamily: 'var(--fd)' }}>
                          SELECT WAGER
                        </h3>
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block">YOUR BALANCE</span>
                          <span className="text-sm font-black text-cyan-400">
                            {isBalanceUpdating ? (
                              <span className="inline-block w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin align-middle" />
                            ) : (
                              `${balance} CHESS`
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-6 mb-8">
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                            Wager Amount (CHESS)
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {[50, 100, 250, 500, 1000, 2500].map(amt => {
                              const isInsufficient = !isBalanceUpdating && (parseFloat(balance) || 0) < amt
                              return (
                                <button
                                  key={amt}
                                  onClick={() => !isInsufficient && setWager(amt)}
                                  disabled={isInsufficient}
                                  style={wager === amt ? { background: 'var(--btn-face)', color: 'var(--btn-text)', boxShadow: 'var(--btn-shadow)' } : undefined}
                                  className={`py-3.5 rounded-2xl border font-black text-xs transition-all active:scale-95 ${
                                    wager === amt
                                      ? 'border-transparent'
                                      : isInsufficient
                                      ? 'bg-black/20 text-gray-600 border-white/5 cursor-not-allowed opacity-40'
                                      : 'bg-black/40 text-gray-300 border-white/5 hover:border-white/10 hover:bg-black/60'
                                  }`}
                                >
                                  {amt}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>

                      {createError && (
                        <p className="text-[9px] text-red-400 font-bold tracking-widest uppercase mb-6 text-center border border-red-500/10 bg-red-500/5 py-2 rounded-xl">
                          {createError}
                        </p>
                      )}

                      {!isBalanceUpdating && (parseFloat(balance) || 0) < wager && (
                        <div className="flex flex-col items-center gap-3 mb-6 py-4 px-4 rounded-2xl border border-red-500/15 bg-red-500/5">
                          <p className="text-[10px] text-red-400 font-bold tracking-[0.2em] uppercase text-center">
                            Not enough CHESS for this wager
                          </p>
                          <GlowButton
                            variant="ghost"
                            size="sm"
                            onClick={() => { setIsCreateModalOpen(false); router.push('/app/faucet') }}
                          >
                            CLAIM FROM FAUCET
                          </GlowButton>
                        </div>
                      )}

                      <div className="flex gap-4">
                        <GlowButton
                          fullWidth
                          variant="brand"
                          onClick={handleCreateGame}
                          disabled={isBalanceUpdating || (parseFloat(balance) || 0) < wager}
                        >
                          INITIALIZE GAME
                        </GlowButton>
                      </div>
                    </>
                  )}
                </div>
              </ClayCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ComingSoonOverlay isOpen={isComingSoonOpen} onClose={() => setIsComingSoonOpen(false)} />
      {playerAddress && (
        <ClaimModal
          open={claimModalOpen}
          address={playerAddress}
          onClose={() => setClaimModalOpen(false)}
        />
      )}
    </main>
  )
}
