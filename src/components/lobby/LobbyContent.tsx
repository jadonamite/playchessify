'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWallet } from '@/components/wallet-provider'
import GlowButton from '@/components/ui/GlowButton'
import ClayCard from '@/components/ui/ClayCard'
import ComingSoonOverlay from '@/components/ui/ComingSoonOverlay'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/landing/Hero'
import { CELO_CONTRACTS, TOKEN_DECIMALS, CELO_CHAIN_ID } from '@/config/contracts'
import { useCeloChess } from '@/hooks/useCeloChess'
import { useLobby } from '@/hooks/useLobby'
import { useBatchProfiles } from '@/hooks/useBatchProfiles'
import { useProfile } from '@/hooks/useProfile'
import ChessName from '@/components/ui/ChessName'
import ChessAvatar from '@/components/ui/ChessAvatar'
import ClaimModal from '@/components/ui/ClaimModal'
import { useSettingsStore } from '@/hooks/useSettingsStore'
import LoadingState from '@/components/ui/LoadingState'
// @ts-expect-error - intentional unused variable
import { useReadContract, useAccount } from 'wagmi'
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
  const { isConnected, address: celoAddress } = useWallet()
  // @ts-expect-error - intentional unused isCeloPending
  const { createGame: createCeloGame, joinGame: joinCeloGame, isPending: isCeloPending } = useCeloChess()
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

  const { data: celoBalance, isPending: isBalanceLoading } = useReadContract({
    address: CELO_CONTRACTS.token as `0x${string}`,
    abi: CHESS_TOKEN_ABI,
    functionName: 'balanceOf',
    args: [celoAddress as `0x${string}`],
    chainId: CELO_CHAIN_ID,
    query: { enabled: !!celoAddress }
  })

  const { data: celoStats } = useReadContract({
    address: CELO_CONTRACTS.game as `0x${string}`,
    abi: CHESS_GAME_ABI,
    functionName: 'playerStats',
    args: [celoAddress as `0x${string}`],
    chainId: CELO_CHAIN_ID,
    query: { enabled: !!celoAddress }
  })

  useEffect(() => {
    if (celoAddress) {
      if (celoBalance !== undefined) setBalance(formatUnits(celoBalance as bigint, TOKEN_DECIMALS))
      if (celoStats) {
        const s = celoStats as any
        setRating(Number(s[3]))
        setWins(Number(s[0]))
        setLosses(Number(s[1]))
      }
    }
  }, [celoAddress, celoBalance, celoStats])

  const { games: openGames, isLoading: isLobbyLoading, refresh: refreshLobby } = useLobby()
  const { data: lobbyProfileMap = {} } = useBatchProfiles(openGames.map((g) => g.creator))

  const { data: myProfile } = useProfile(celoAddress ?? null)
  const [claimModalOpen, setClaimModalOpen] = useState(false)
  const showClaimBanner = isConnected && !!celoAddress && myProfile === null

  const { soundEnabled } = useSettingsStore()

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
    } catch (err: any) {
      const msg = err?.message?.includes('cancelled')
        ? 'Transaction cancelled.'
        : 'Failed to create game. Check your balance and try again.'
      setCreateError(msg)
    } finally {
      setIsPending(false)
    }
  }

  const handleJoinGame = async (gameId: number, matchWager: number) => {
    if (MAINTENANCE_MODE) return setIsComingSoonOpen(true)
    setIsPending(true)
    try {
      await joinCeloGame(gameId, matchWager)
      router.push(`/app/game/${gameId}`)
    } catch (err: any) {
      if (!err?.message?.includes('cancelled')) {
        console.error('[LobbyContent] handleJoinGame failed:', err)
      }
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

  // Not authenticated at all — redirect
  if (!isConnected) {
    return <main className="min-h-screen w-full bg-[var(--bg)]" />
  }

  // Authenticated but wallet address still being provisioned (Privy embedded wallet)
  if (!celoAddress) {
    return (
      <main className="min-h-screen w-full bg-[var(--bg)] flex items-center justify-center">
        <LoadingState message="SETTING UP WALLET" />
      </main>
    )
  }

  return (
    <main className="min-h-screen w-full max-w-[100vw] bg-[var(--bg)] text-[var(--t1)] relative flex flex-col box-border overflow-x-hidden">
      <Navbar />

      {/* Static Background */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-50 bg-[var(--bg)]" />

      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px)', backgroundSize: '52px 52px', pointerEvents: 'none', zIndex: 0, opacity: 0.4 }} />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-full box-border px-4 md:px-8 py-12 md:py-24">

        {/* ── .chess onboarding banner ── */}
        {showClaimBanner && celoAddress && (
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start w-full max-w-7xl mx-auto box-border">

          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-8 flex flex-col gap-6 md:gap-8 w-full min-w-0 box-border">

            {/*
              FIX: Shell/content split.
              The outer div owns ALL visual properties that create a stacking context:
              backdrop-blur, background, border, border-radius, shadow.
              The inner div owns ALL spacing: padding.
              This prevents backdrop-blur from interfering with padding compositing.
            */}

            {/* ── CARD 1: Game Lobby Header ── */}
            <div className="rounded-[32px] border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-2xl relative overflow-hidden">
              <BgIcon>
                <svg viewBox="0 0 24 24" fill="none" width="100%" height="100%">
                  <path d="M12 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </BgIcon>
              <div className="p-6 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
                  <h1
                    className="text-4xl md:text-[52px] font-black uppercase tracking-tighter leading-none"
                    style={{ fontFamily: 'var(--fd)', textShadow: 'var(--hero-text-shadow)' }}
                  >
                    Game{' '}
                    <span style={{ color: 'var(--c)', textShadow: 'var(--king-text-shadow)' }}>
                      Lobby
                    </span>
                  </h1>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-black/40 py-1.5 px-3 rounded-full border border-white/10 shadow-inner">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--c)] animate-pulse" />
                      <span
                        className="text-[11px] tracking-[0.2em] font-bold text-[var(--c)]"
                        style={{ fontFamily: 'var(--fd)' }}
                      >
                        CELO
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-black/20 rounded-full border border-white/5">
                      <span
                        className="text-[10px] tracking-[0.15em] uppercase font-bold text-[var(--t2)]"
                        style={{ fontFamily: 'var(--fd)' }}
                      >
                        RATING
                      </span>
                      <span className="text-sm tracking-widest font-black text-white">
                        {rating}{' '}
                        <span className="text-[10px] text-[var(--c)] opacity-80">ELO</span>
                      </span>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="shrink-0 flex flex-col gap-3 w-full md:w-auto"
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
            </div>

            {/* ── CARD 2: Open Challenges ── */}
            <div className="rounded-[32px] border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-2xl relative overflow-hidden">
              <BgIcon>
                <svg viewBox="0 0 24 24" fill="none" width="100%" height="100%">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.2" />
                  <line x1="12" y1="12" x2="17.5" y2="8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </BgIcon>
              <div className="p-6 md:p-10 flex flex-col gap-6 relative z-10">
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
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="ENTER MATCH ID..."
                        value={searchId}
                        onChange={(e) => { setSearchId(e.target.value); setSearchError(null) }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchJoin()}
                        className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] tracking-widest uppercase font-bold text-white placeholder:text-white/20 focus:outline-none focus:border-[var(--c)]/50 transition-colors w-40"
                      />
                      <GlowButton
                        variant="brand"
                        size="sm"
                        onClick={handleSearchJoin}
                        disabled={!searchId}
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
                    >
                      {/*
                        Challenge row: also split — outer for visual chrome,
                        inner for padding. Keeps hover states clean.
                      */}
                      <div className="rounded-2xl border border-white/5 bg-black/40 hover:bg-black/60 hover:border-white/10 transition-colors">
                        <div className="p-5 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">

                          <div className="flex items-center gap-5 w-full sm:w-auto min-w-0">
                            <div className="w-14 h-14 shrink-0 rounded-xl flex flex-col items-center justify-center font-bold text-cyan-400 bg-cyan-950/30 border border-cyan-500/20">
                              <span className="text-[9px] uppercase tracking-widest opacity-60">ELO</span>
                              <span className="text-base leading-none mt-1">{game.elo}</span>
                            </div>
                            <div className="flex items-center gap-3 min-w-0">
                              <ChessAvatar address={game.creator} size={32} />
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
                                  className="font-bold tracking-wide text-base text-gray-200 truncate max-w-full"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between w-full sm:w-auto sm:gap-8 border-t sm:border-t-0 border-white/5 pt-4 sm:pt-0 shrink-0">
                            <div className="flex flex-col justify-center sm:text-right">
                              <span
                                className="text-[10px] tracking-[0.2em] text-gray-500 uppercase font-bold mb-1"
                                style={{ fontFamily: 'var(--fd)' }}
                              >
                                WAGER
                              </span>
                              <div className="font-black text-cyan-400 text-lg leading-none">
                                {game.wager}{' '}
                                <span className="text-[10px] text-cyan-700">CHESS</span>
                              </div>
                            </div>
                            <GlowButton
                              size="md"
                              onClick={() => handleJoinGame(game.id, game.wager)}
                              disabled={isPending}
                              className="min-w-[120px] shrink-0"
                            >
                              {isPending ? '...' : 'JOIN MATCH'}
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
            </div>

          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="lg:col-span-4 flex flex-col gap-6 md:gap-8 h-auto w-full min-w-0 box-border">

            {/* ── CARD 3: Profile Stats ── */}
            <div className="rounded-[32px] border border-white/10 bg-slate-900/60 backdrop-blur-md shadow-2xl relative overflow-hidden">
              <BgIcon>
                <svg viewBox="0 0 24 24" fill="none" width="100%" height="100%">
                  <polyline points="2 17 8.5 10.5 13.5 15.5 22 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="16 7 22 7 22 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </BgIcon>
              <div className="p-6 md:p-10 flex flex-col relative z-10">
                <h3
                  className="text-sm font-bold tracking-wider text-cyan-400 uppercase mb-8"
                  style={{ fontFamily: 'var(--fd)' }}
                >
                  Profile Stats
                </h3>

                <div className="flex items-baseline gap-2 mb-10">
                  <span
                    className="text-5xl font-black text-white leading-none"
                    style={{ fontFamily: 'var(--fd)' }}
                  >
                    {balance}
                  </span>
                  <span className="text-sm text-cyan-500 font-bold tracking-widest">CHESS</span>
                </div>

                <div className="flex justify-between items-center bg-black/40 p-5 rounded-2xl border border-white/5 mb-8">
                  <div className="flex flex-col flex-1">
                    <span className="text-[11px] text-gray-500 font-bold tracking-widest uppercase mb-2">
                      Wins
                    </span>
                    <span className="text-2xl font-bold text-white leading-none">{wins}</span>
                  </div>
                  <div className="w-[1px] h-10 bg-white/10 mx-4 shrink-0" />
                  <div className="flex flex-col flex-1 text-right">
                    <span className="text-[11px] text-gray-500 font-bold tracking-widest uppercase mb-2">
                      Losses
                    </span>
                    <span className="text-2xl font-bold text-gray-300 leading-none">{losses}</span>
                  </div>
                </div>

                <div className="mt-auto pt-2 w-full">
                  <GlowButton
                    variant="ghost"
                    fullWidth
                    onClick={() => handleAction(() => router.push('/app/history'))}
                  >
                    VIEW HISTORY
                  </GlowButton>
                </div>
              </div>
            </div>

            {/* ── CARD 4: Need CHESS? ── */}
            <div className="rounded-[32px] border border-white/10 bg-slate-900/60 backdrop-blur-md shadow-2xl relative overflow-hidden">
              <BgIcon>
                <svg viewBox="0 0 24 24" fill="none" width="100%" height="100%">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </BgIcon>
              <div className="p-6 md:p-10 flex flex-col gap-3 relative z-10">
                <h4
                  className="font-bold text-[15px] tracking-widest text-white uppercase"
                  style={{ fontFamily: 'var(--fd)' }}
                >
                  Need CHESS?
                </h4>
                <p className="text-[13px] text-gray-400 leading-relaxed">
                  Top up your wallet with testnet tokens to start playing on Celo.
                </p>
                <div className="mt-4 w-full">
                  <GlowButton
                    variant="brand"
                    fullWidth
                    onClick={() => handleAction(() => router.push('/app/faucet'))}
                  >
                    VISIT FAUCET
                  </GlowButton>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── CREATE MATCH MODAL ── */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 box-border">
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
              className="relative w-full max-w-md box-border"
            >
              {/*
                ClayCard already manages its own shell correctly.
                The inner padding div keeps content away from the blur boundary.
              */}
              <ClayCard className="overflow-hidden border border-white/10 bg-slate-950/90 backdrop-blur-2xl shadow-[0_24px_60px_rgba(0,0,0,0.8)] rounded-[32px]">
                <div className="p-8 md:p-10 relative">
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
                            {isBalanceLoading ? (
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
                              const isInsufficient = !isBalanceLoading && (parseFloat(balance) || 0) < amt
                              return (
                                <button
                                  key={amt}
                                  onClick={() => !isInsufficient && setWager(amt)}
                                  disabled={isInsufficient}
                                  className={`py-3.5 rounded-2xl border font-black text-xs transition-all ${
                                    wager === amt
                                      ? 'bg-cyan-400 text-black border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.45)]'
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

                      {!isBalanceLoading && (parseFloat(balance) || 0) < wager && (
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
                          disabled={isBalanceLoading || (parseFloat(balance) || 0) < wager}
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
      {celoAddress && (
        <ClaimModal
          open={claimModalOpen}
          address={celoAddress}
          onClose={() => setClaimModalOpen(false)}
        />
      )}
    </main>
  )
}
