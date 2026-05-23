'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Chess } from 'chess.js'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useWallet } from '@/components/wallet-provider'
import { useCeloChess } from '@/hooks/useCeloChess'
import { useReadContract } from 'wagmi'
import { CHESS_GAME_ABI } from '@/config/abis'
import { CELO_CONTRACTS, CELO_CHAIN_ID } from '@/config/contracts'
import ClayCard from '@/components/ui/ClayCard'
import GlowButton from '@/components/ui/GlowButton'
import StatBadge from '@/components/ui/StatBadge'
import LoadingState from '@/components/ui/LoadingState'
import PromotionModal, { PromotionPiece } from '@/components/ui/PromotionModal'
import { Navbar } from '@/components/landing/Hero'
import { getBestMove } from '@/lib/chess-engine'
import { TOKEN_DECIMALS } from '@/config/contracts'
import { useGameMoves } from '@/hooks/useGameMoves'
import { useToastStore } from '@/hooks/useToastStore'

const BOT_SAVE_KEY = 'chess-bot-save'

// Dynamically import Chessboard to avoid SSR issues
const Chessboard = dynamic(() => import('react-chessboard').then(mod => mod.Chessboard), { ssr: false })

// ─── types ─────────────────────────────────────────────────────────────────

interface GameData {
  player1: string
  player2: string
  wager: string
  status: string
}

interface PlayerStats {
  wins: number
  losses: number
  rating: number
}

// ─── component ─────────────────────────────────────────────────────────────

export default function GameClient() {
  const params = useParams()
  const isBotGame = params?.id === 'bot'
  const gameId = isBotGame ? 0 : Number(params?.id ?? 0)

  const { address: celoAddress, isConnected, connectWallet } = useWallet()

  const {
    submitMove: submitCeloMove,
    joinGame: joinCelo,
    resign: resignCelo,
    reportWin: reportCeloWin
  } = useCeloChess()

  const showToast = useToastStore((s) => s.showToast)

  const [game, setGame] = useState(() => {
    if (typeof window === 'undefined' || !isBotGame) return new Chess()
    try {
      const saved = localStorage.getItem(BOT_SAVE_KEY)
      if (saved) {
        const { fen } = JSON.parse(saved)
        return new Chess(fen)
      }
    } catch { /* corrupt save — start fresh */ }
    return new Chess()
  })

  const [gameData, setGameData] = useState<GameData | null>(null)
  // @ts-expect-error - setPlayerStats populated via future useReadContract
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null)

  const [moveHistory, setMoveHistory] = useState<string[]>(() => {
    if (typeof window === 'undefined' || !isBotGame) return []
    try {
      const saved = localStorage.getItem(BOT_SAVE_KEY)
      if (saved) {
        const { history } = JSON.parse(saved)
        return Array.isArray(history) ? history : []
      }
    } catch { /* ignore */ }
    return []
  })

  const [txPending, setTxPending] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [moveFrom, setMoveFrom] = useState<string>('')
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string; color: 'white' | 'black' } | null>(null)

  // Bot reply timer — cleared on unmount so setState never fires after teardown
  const botReplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (botReplyTimerRef.current) clearTimeout(botReplyTimerRef.current)
  }, [])

  const resetBotGame = useCallback(() => {
    if (botReplyTimerRef.current) { clearTimeout(botReplyTimerRef.current); botReplyTimerRef.current = null }
    localStorage.removeItem(BOT_SAVE_KEY)
    setGame(new Chess())
    setMoveHistory([])
    setMoveFrom('')
  }, [])

  // Poll game data on Celo so WAITING → ACTIVE transitions surface without a refresh
  const { data: celoGameData } = useReadContract({
    address: CELO_CONTRACTS.game as `0x${string}`,
    abi: CHESS_GAME_ABI,
    functionName: 'getGame',
    args: [BigInt(gameId)],
    chainId: CELO_CHAIN_ID,
    query: {
      enabled: !isBotGame && gameId !== undefined && gameId !== null && !isNaN(gameId),
      refetchInterval: 5_000,
    }
  })

  // ── FIX 1: Celo game data — use a dedicated effect so it re-runs
  // when celoGameData arrives asynchronously (instead of being blocked
  // by the old dataLoaded guard).
  useEffect(() => {
    if (celoGameData) {
      const gd = celoGameData as any
      setGameData({
        player1: gd.white,
        player2: gd.black,
        wager: gd.wager.toString(),
        status: gd.status.toString()
      })
    }
  }, [celoGameData])

  // ── derived ──────────────────────────────────────────────────────────────

  const ZERO_ADDR = '0x0000000000000000000000000000000000000000'
  const STATUS_LABELS: Record<string, string> = {
    '0': 'WAITING',
    '1': 'ACTIVE',
    '2': 'FINISHED',
    '3': 'CANCELLED',
    '4': 'DRAW',
  }
  const normalize = (a: string) => (a ?? '').toLowerCase()
  const myAddress = normalize(celoAddress ?? '')

  const gameIsWaiting = gameData?.status === '0'
  const isCreator = !!gameData && normalize(gameData.player1) === myAddress && myAddress !== ''
  const isOpponent = !!gameData && normalize(gameData.player2) === myAddress && gameData.player2 !== '' && gameData.player2 !== ZERO_ADDR
  const isParticipant = isCreator || isOpponent
  // User navigated directly (e.g. via search) to a WAITING game they haven't joined
  const canJoinFromPage = gameIsWaiting && !isParticipant && !isBotGame && isConnected

  // Color assignment: creator (player1) is white, opponent (player2) is black.
  // Mirrors the contract's assignment in chess-game.clar / ChessGame.sol.
  const myColor: 'white' | 'black' | null = isBotGame
    ? 'white'
    : isCreator
      ? 'white'
      : isOpponent
        ? 'black'
        : null
  const isMyTurn = isBotGame
    ? game.turn() === 'w'
    : (game.turn() === 'w' && myColor === 'white') || (game.turn() === 'b' && myColor === 'black')

  const canAct = isBotGame ? !txPending : isConnected && !txPending && isParticipant
  const gameOver = game.isGameOver()
  const turn = game.turn()

  const wagerFormatted = gameData
    ? (Number(gameData.wager) / Math.pow(10, TOKEN_DECIMALS)).toFixed(0)
    : '0'
  const statusLabel = gameData ? (STATUS_LABELS[gameData.status] ?? 'UNKNOWN') : ''

  // ── move relay ──────────────────────────────────────────────────────────
  // The relay is the shared truth for the board position between both players.
  // Only enable once we know it's a PvP game with a valid id and chain.
  const {
    moves: relayMoves,
    submitMove: relaySubmitMove,
    error: relayError,
  } = useGameMoves({
    chain: 'celo',
    gameId,
    // Don't block on gameData — relay can start polling as soon as we have a valid gameId.
    // gameData arriving later won't affect move history already loaded from relay.
    enabled: !isBotGame && gameId > 0,
  })

  // ── board interaction ────────────────────────────────────────────────────

  // Rebuild the chess.js position from the relay-sourced move list. The relay
  // is the authoritative truth for PvP — if local optimistic state diverges
  // (e.g. after a 409), this effect overwrites it. Bot games skip the relay.
  useEffect(() => {
    if (isBotGame) return
    if (relayMoves.length === 0) return

    const replayed = new Chess()
    const sanHistory: string[] = []
    for (const m of relayMoves) {
      const result = replayed.move(m.san)
      if (!result) {
        console.error('[GameClient] relay move rejected by chess.js — aborting replay to avoid corrupted state', { move: m })
        return
      }
      sanHistory.push(result.san)
    }

    // Compare full SAN sequence rather than just length — guards against the
    // case where lengths match but contents differ (optimistic-vs-authoritative).
    const same = sanHistory.length === moveHistory.length &&
      sanHistory.every((san, i) => san === moveHistory[i])
    if (same) return

    setGame(new Chess(replayed.fen()))
    setMoveHistory(sanHistory)

    if (replayed.isCheckmate()) {
      showToast('The King has fallen. End of line.', 'checkmate')
    } else if (replayed.inCheck()) {
      showToast('Your King is under direct assault. You must parry or evade!', 'check')
    } else if (replayed.isDraw() || replayed.isStalemate()) {
      showToast('Tactical deadlock achieved. Neither commander can proceed.', 'draw')
    }
  }, [relayMoves, isBotGame, moveHistory, showToast])

  // Core move executor — synchronous local apply (so react-chessboard's drop
  // handler gets its boolean), then a fire-and-forget relay POST for PvP.
  // If the relay 409s, the replay effect resyncs board state from authoritative truth.
  // If the move is a pawn promotion and no piece was chosen yet, defers to the
  // promotion modal: stashes the pending move and returns true so the board
  // accepts the drop visually while we wait for the user's selection.
  const executeMove = useCallback((sourceSquare: string, targetSquare: string, promotion?: PromotionPiece): boolean => {
    try {
      // Detect promotion: any legal move from this square to this target that
      // carries a `promotion` field means the user must pick a piece.
      if (!promotion) {
        const legalFromSquare = game.moves({ square: sourceSquare as any, verbose: true }) as any[]
        const promo = legalFromSquare.find((m) => m.to === targetSquare && m.promotion)
        if (promo) {
          setPendingPromotion({
            from: sourceSquare,
            to: targetSquare,
            color: promo.color === 'w' ? 'white' : 'black',
          })
          return true
        }
      }

      const next = new Chess(game.fen())
      const move = next.move({ from: sourceSquare, to: targetSquare, promotion: promotion ?? 'q' })
      if (!move) {
        showToast(game.inCheck() ? 'Your King is in check — you must resolve it first.' : "You can't move there.", 'invalid')
        return false
      }

      // Optimistic local commit
      setGame(next)
      const newHistory = [...moveHistory, move.san]
      setMoveHistory(newHistory)

      // Persist bot game after every half-move
      if (isBotGame) {
        try {
          localStorage.setItem(BOT_SAVE_KEY, JSON.stringify({ fen: next.fen(), history: newHistory }))
        } catch { /* storage quota */ }
      }

      // Status notifications from the new position
      if (next.isCheckmate()) {
        showToast('The King has fallen. End of line.', 'checkmate')
        if (isBotGame) localStorage.removeItem(BOT_SAVE_KEY)
      } else if (next.inCheck()) {
        showToast('King under direct assault — parry or evade!', 'check')
      } else if (next.isDraw() || next.isStalemate()) {
        showToast('Tactical deadlock — neither commander can proceed.', 'draw')
        if (isBotGame) localStorage.removeItem(BOT_SAVE_KEY)
      }

      // PvP: sync to relay, then silently record on-chain for timeout tracking
      if (!isBotGame) {
        const player = celoAddress ?? ''
        void relaySubmitMove(move.san, player).then(async (ok) => {
          if (!ok) {
            console.warn('[GameClient] relay rejected move — resyncing', { san: move.san })
            showToast('Move conflict with opponent — resyncing board.', 'invalid')
            return
          }
          // Silent on-chain checkpoint — updates turn + lastMoveBlock for timeout enforcement.
          // Runs after relay confirms so we don't block the chess UX.
          try {
            await submitCeloMove(gameId)
          } catch {
            // Non-critical: game continues via relay even if on-chain checkpoint fails.
            console.warn('[GameClient] on-chain submitMove failed — gameplay unaffected')
          }
        })
      }

      // Bot reply after a beat
      if (isBotGame && !next.isGameOver()) {
        if (botReplyTimerRef.current) clearTimeout(botReplyTimerRef.current)
        botReplyTimerRef.current = setTimeout(() => {
          botReplyTimerRef.current = null
          const afterPlayer = new Chess(next.fen())
          const botMove = getBestMove(afterPlayer, 3)
          if (botMove) {
            afterPlayer.move(botMove)
            const afterFen = afterPlayer.fen()
            setGame(new Chess(afterFen))
            setMoveHistory(h => {
              const updated = [...h, botMove.san]
              try { localStorage.setItem(BOT_SAVE_KEY, JSON.stringify({ fen: afterFen, history: updated })) } catch { /* ignore */ }
              return updated
            })
            if (afterPlayer.isCheckmate()) {
              showToast('The King has fallen. End of line.', 'checkmate')
              localStorage.removeItem(BOT_SAVE_KEY)
            } else if (afterPlayer.inCheck()) {
              showToast('King under direct assault — parry or evade!', 'check')
            } else if (afterPlayer.isDraw() || afterPlayer.isStalemate()) {
              showToast('Tactical deadlock — neither commander can proceed.', 'draw')
              localStorage.removeItem(BOT_SAVE_KEY)
            }
          }
        }, 1200)
      }
      return true
    } catch (e) {
      console.error('[GameClient] executeMove failed:', e)
      showToast(game.inCheck() ? 'Your King is in check — resolve it first.' : "You can't move there.", 'invalid')
      return false
    }
  }, [game, moveHistory, isBotGame, celoAddress, relaySubmitMove, showToast])

  // ── v5 onPieceDrop: receives an object { piece, sourceSquare, targetSquare }
  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: { piece: any; sourceSquare: string; targetSquare: string | null }): boolean => {
      if (!targetSquare) return false
      return executeMove(sourceSquare, targetSquare)
    },
    [executeMove]
  )

  const handlePromotionSelect = useCallback((piece: PromotionPiece) => {
    if (!pendingPromotion) return
    const { from, to } = pendingPromotion
    setPendingPromotion(null)
    executeMove(from, to, piece)
  }, [pendingPromotion, executeMove])

  const handlePromotionCancel = useCallback(() => {
    setPendingPromotion(null)
  }, [])

  // ── v5 onSquareClick: receives an object { piece, square }
  const handleSquareClick = useCallback(
    ({ square }: { piece: any; square: string }) => {
      if (!canAct || gameOver) return
      // Bot game: bot always plays black, so block clicks when it's bot's turn
      if (isBotGame && game.turn() === 'b') return
      // PvP: only the player whose color is on the move can interact
      if (!isBotGame && !isMyTurn) return

      if (!moveFrom) {
        const piece = game.get(square as any)
        if (piece && piece.color === game.turn()) setMoveFrom(square)
        return
      }

      // Re-select own piece
      const piece = game.get(square as any)
      if (piece && piece.color === game.turn()) {
        setMoveFrom(square)
        return
      }

      executeMove(moveFrom, square)
      setMoveFrom('') // always clear
    },
    [canAct, gameOver, game, moveFrom, executeMove, isBotGame, isMyTurn]
  )

  // ── v5 canDragPiece: receives { isSparePiece, piece, square }
  const handleCanDragPiece = useCallback(
    ({ square }: { isSparePiece: boolean; piece: any; square: string | null }): boolean => {
      if (!canAct || gameOver) return false
      if (isBotGame && game.turn() === 'b') return false
      if (!isBotGame && !isMyTurn) return false
      if (!square) return false
      const piece = game.get(square as any)
      return !!piece && piece.color === game.turn()
    },
    [canAct, gameOver, isBotGame, isMyTurn, game]
  )

  // ── tx helpers ───────────────────────────────────────────────────────────

  const withTx = useCallback(async (fn: () => Promise<unknown> | undefined) => {
    if (txPending) return
    setTxPending(true)
    try { await fn() } catch (e) { console.error('[GameClient] tx error:', e) } finally { setTxPending(false) }
  }, [txPending])

  const handleResign = async () => {
    await withTx(async () => {
      await resignCelo(gameId)
    })
  }

  const handleReportWin = async () => {
    await withTx(async () => {
      await reportCeloWin(gameId)
    })
  }

  const handleJoinMatch = async () => {
    if (!gameData) return
    await withTx(async () => {
      const wagerInChess = Number(gameData.wager) / Math.pow(10, TOKEN_DECIMALS)
      await joinCelo(gameId, wagerInChess)
    })
  }

  // ── game loading timeout ─────────────────────────────────────────────────
  // Show a "not found" hint after 8s if game data hasn't arrived.
  useEffect(() => {
    if (isBotGame) return
    if (gameData) return
    const timer = setTimeout(() => {
      setLoadError(true)
    }, 8_000)
    return () => clearTimeout(timer)
  }, [isBotGame, gameData])

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--t1)]">
      <Navbar />

      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-[10%] right-[10%] w-[30%] h-[30%] bg-[var(--c)] blur-[120px] rounded-full opacity-20" />
        <div className="absolute bottom-[10%] left-[10%] w-[30%] h-[30%] bg-[#783cdc] blur-[120px] rounded-full opacity-10" />
      </div>

      {!isBotGame && !gameData ? (
        <div className="min-h-screen flex flex-col items-center justify-center gap-8 relative z-10">
          <LoadingState message={loadError ? `MATCH #${gameId} NOT FOUND` : `RETRIEVING MATCH DATA #${gameId}`} />
          {loadError && (
            <p className="text-[var(--t3)] text-xs font-bold tracking-widest text-center max-w-sm -mt-4">
              Match not found on Celo. Please check the match ID and try again.
            </p>
          )}
          <Link href="/app/lobby">
            <GlowButton variant="ghost" size="sm" parallelogram>← BACK TO LOBBY</GlowButton>
          </Link>
        </div>
      ) : (
        <main className="relative z-10 max-w-7xl mx-auto px-6 py-12 pt-32">
          {/* ── header ── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
                {isBotGame ? (
                  <>AI <span className="text-[var(--c)]">Training</span></>
                ) : (
                  <>Match <span className="text-[var(--c)]">#{gameId}</span></>
                )}
              </h1>
              {isBotGame ? (
                <div className="flex gap-4 mt-4">
                  <StatBadge label="MODE" value="SINGLE PLAYER" accent />
                  <StatBadge label="OPPONENT" value="SYSTEM BOT" />
                </div>
              ) : gameData && (
                <div className="flex flex-wrap gap-4 mt-4">
                  <StatBadge label="WAGER" value={`${wagerFormatted} CHESS`} accent />
                  <StatBadge label="STATUS" value={statusLabel} />
                  {myColor && <StatBadge label="YOU PLAY" value={myColor.toUpperCase()} />}
                </div>
              )}
            </div>
            <Link href="/app/lobby">
              <GlowButton variant="ghost" size="sm" parallelogram>← BACK TO LOBBY</GlowButton>
            </Link>
          </div>

          {/* ── grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Board Area */}
            <div className="lg:col-span-8">
              <ClayCard className="p-4 md:p-8 relative overflow-hidden">
                {/* Watermark Piece */}
                <div className="absolute -right-10 -bottom-10 opacity-[0.03] rotate-12 pointer-events-none">
                  <svg width="300" height="300" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19,22H5V20H19V22M17,10C17,8.9 16.1,8 15,8V7C15,5.34 13.66,4 12,4C10.34,4 9,5.34 9,7V8C7.9,8 7,8.9 7,10V11H17V10M15,13H9V18H15V13Z" />
                  </svg>
                </div>

                <div className="max-w-[600px] mx-auto aspect-square">
                  {/* react-chessboard v5: ALL props go inside the `options` object */}
                  <Chessboard
                    options={{
                      id: 'BasicBoard',
                      position: game.fen(),
                      boardOrientation: myColor === 'black' ? 'black' : 'white',
                      // Drag — bot games allow only when it's white's turn (player);
                      // PvP allows only when it's the player's color's turn
                      allowDragging: canAct && !gameOver && (isBotGame ? turn === 'w' : isMyTurn),
                      canDragPiece: handleCanDragPiece,
                      onPieceDrop: handlePieceDrop,
                      // Click-to-move
                      onSquareClick: handleSquareClick,
                      // Styles
                      darkSquareStyle: { backgroundColor: '#0f172a' },
                      lightSquareStyle: { backgroundColor: '#1e293b' },
                      squareStyles: moveFrom
                        ? { [moveFrom]: { backgroundColor: 'rgba(0, 204, 255, 0.4)' } }
                        : {},
                      boardStyle: {
                        borderRadius: '12px',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                      },
                    }}
                  />
                </div>

                {/* Turn Indicator */}
                <div className="mt-8 text-center flex flex-col items-center gap-2">
                  {gameOver ? (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="px-6 py-3 rounded-2xl bg-[var(--c)]/10 border border-[var(--c)]/30 text-[var(--c)] font-black uppercase italic tracking-widest text-lg"
                    >
                      {game.isCheckmate() ? 'CHECKMATE' : 'GAME OVER'}
                    </motion.div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full animate-pulse ${turn === 'w' ? 'bg-white shadow-[0_0_10px_white]' : 'bg-gray-600'}`} />
                      <span className="text-sm font-bold tracking-widest text-[var(--t3)] uppercase">
                        {turn === 'w' ? 'White to move' : 'Black to move'}
                      </span>
                    </div>
                  )}
                </div>
              </ClayCard>
            </div>

            {/* Sidebar Area */}
            <div className="lg:col-span-4 space-y-6">

              {/* Player Stats */}
              <ClayCard variant="inset" className="p-6">
                <h3 className="text-[10px] font-black tracking-[0.2em] text-[var(--t3)] uppercase mb-4">Commander Stats</h3>
                <div className="grid grid-cols-2 gap-3">
                  {/* @ts-ignore - intentional fullWidth */}
                  <StatBadge label="ELO" value={playerStats?.rating || 1200} accent fullWidth />
                  {/* @ts-ignore - intentional fullWidth */}
                  <StatBadge label="W/L" value={`${playerStats?.wins || 0}/${playerStats?.losses || 0}`} fullWidth />
                </div>
              </ClayCard>

              {/* Actions — context-aware based on game state */}
              {canJoinFromPage ? (
                // Visitor who navigated directly to a WAITING game
                <ClayCard className="p-6">
                  <h3 className="text-[10px] font-black tracking-[0.2em] text-[var(--t3)] uppercase mb-4">Open Challenge</h3>
                  <p className="text-xs text-[var(--t2)] mb-1">
                    Wager:{' '}
                    <span className="text-[var(--c)] font-black">
                      {(Number(gameData?.wager ?? 0) / Math.pow(10, TOKEN_DECIMALS)).toFixed(0)} CHESS
                    </span>
                  </p>
                  <p className="text-[10px] text-[var(--t3)] mb-6 leading-relaxed">
                    Accepting this challenge locks the matching wager from your wallet.
                  </p>
                  <GlowButton
                    variant="brand"
                    fullWidth
                    parallelogram
                    loading={txPending}
                    onClick={handleJoinMatch}
                  >
                    CONFIRM JOIN
                  </GlowButton>
                </ClayCard>
              ) : gameIsWaiting && isCreator ? (
                // Creator waiting for an opponent
                <ClayCard className="p-6">
                  <h3 className="text-[10px] font-black tracking-[0.2em] text-[var(--t3)] uppercase mb-4">Waiting for Opponent</h3>
                  <p className="text-xs text-[var(--t2)] mb-4 leading-relaxed">
                    Share your match ID with your opponent so they can join.
                  </p>
                  <div className="flex items-center gap-2 bg-black/40 rounded-xl p-3 border border-white/10 mb-6">
                    <span className="text-2xl font-black text-[var(--c)] tracking-widest flex-1 text-center">
                      #{gameId}
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(String(gameId))}
                      className="text-[9px] font-black tracking-widest uppercase text-[var(--t3)] hover:text-[var(--c)] transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                    >
                      COPY
                    </button>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--c)] animate-pulse" />
                    <span className="text-[10px] text-[var(--t3)] tracking-widest uppercase font-bold">
                      Watching for opponent...
                    </span>
                  </div>
                </ClayCard>
              ) : isBotGame ? (
                // Bot training session
                <ClayCard className="p-6">
                  <h3 className="text-[10px] font-black tracking-[0.2em] text-[var(--t3)] uppercase mb-4">Training Session</h3>
                  <div className="space-y-3">
                    <GlowButton variant="brand" fullWidth parallelogram onClick={resetBotGame}>
                      {gameOver ? 'PLAY AGAIN' : 'NEW GAME'}
                    </GlowButton>
                    <p className="text-[10px] text-[var(--t3)] text-center leading-relaxed">
                      {gameOver ? 'Game over — start a fresh match.' : 'Resets the board. Progress is saved on reload.'}
                    </p>
                  </div>
                </ClayCard>
              ) : (
                // PvP — turn state + end-game actions
                <>
                  {/* Turn indicator */}
                  {!gameOver && (
                    <ClayCard className="p-5">
                      {isMyTurn ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_#4ade80]" />
                            <span className="text-[10px] font-black tracking-[0.2em] text-green-400 uppercase">Your Turn</span>
                          </div>
                          <p className="text-[11px] text-[var(--t3)] leading-relaxed">
                            Drag or click a piece to move. Your opponent sees it automatically.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#fbbf24]" />
                            <span className="text-[10px] font-black tracking-[0.2em] text-amber-400 uppercase">Opponent&apos;s Turn</span>
                          </div>
                          <p className="text-[11px] text-[var(--t3)] leading-relaxed">
                            Waiting for their move…
                          </p>
                          <div className="flex items-center gap-2 mt-1 pt-2 border-t border-white/5">
                            <div className={`w-1.5 h-1.5 rounded-full ${relayError ? 'bg-red-400' : 'bg-[var(--c)] animate-pulse'}`} />
                            <span className={`text-[9px] font-bold tracking-widest uppercase ${relayError ? 'text-red-400' : 'text-[var(--c)]'}`}>
                              {relayError ? 'Relay offline' : 'Live sync active'}
                            </span>
                          </div>
                        </div>
                      )}
                    </ClayCard>
                  )}

                  {/* End-game actions */}
                  <ClayCard className="p-5">
                    <h3 className="text-[10px] font-black tracking-[0.2em] text-[var(--t3)] uppercase mb-3">
                      {gameOver ? 'Game Over' : 'End Game'}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <GlowButton
                        variant="ghost"
                        size="sm"
                        disabled={!canAct || !gameOver}
                        loading={txPending}
                        onClick={handleReportWin}
                      >
                        CLAIM WIN
                      </GlowButton>
                      <GlowButton
                        variant="ghost"
                        size="sm"
                        disabled={!canAct || gameOver}
                        loading={txPending}
                        className="text-red-400 !border-red-500/20 hover:!bg-red-500/10"
                        onClick={handleResign}
                      >
                        RESIGN
                      </GlowButton>
                    </div>
                    {!gameOver && (
                      <p className="text-[9px] text-[var(--t3)] text-center mt-3 leading-relaxed opacity-60">
                        Resigning or claiming win requires a Celo transaction.
                      </p>
                    )}
                  </ClayCard>
                </>
              )}


              {/* History */}
              <ClayCard variant="inset" className="p-6">
                <h3 className="text-[10px] font-black tracking-[0.2em] text-[var(--t3)] uppercase mb-4">Move Log</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                  {moveHistory.map((san, i) => (
                    <div key={i} className={`flex items-center gap-2 text-xs font-mono p-2 rounded-lg ${i % 2 === 0 ? 'bg-white/5' : ''}`}>
                      <span className="text-[var(--t3)] w-4 text-left">{Math.floor(i / 2) + 1}.</span>
                      <span className={i % 2 === 0 ? 'text-[var(--t1)]' : 'text-[var(--t2)]'}>{san}</span>
                    </div>
                  ))}
                  {moveHistory.length === 0 && (
                    <p className="col-span-2 text-center text-xs text-[var(--t3)] py-4">Waiting for first strike...</p>
                  )}
                </div>
              </ClayCard>

              {/* Network Sync */}
              {!isConnected && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-center flex flex-col gap-3 items-center"
                >
                  <span className="text-yellow-200/70 text-[10px] uppercase font-bold tracking-widest">
                    Connection required for tactical input
                  </span>
                  <GlowButton variant="brand" size="sm" onClick={connectWallet}>
                    CONNECT WALLET
                  </GlowButton>
                </motion.div>
              )}
            </div>

          </div>
        </main>
      )}

      <PromotionModal
        open={!!pendingPromotion}
        color={pendingPromotion?.color ?? 'white'}
        onSelect={handlePromotionSelect}
        onCancel={handlePromotionCancel}
      />
    </div>
  )
}