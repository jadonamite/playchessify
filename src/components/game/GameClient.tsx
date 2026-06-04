'use client'

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Chess, type Square, type Move } from 'chess.js'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useWallet } from '@/components/wallet-provider'
import { useCeloChess } from '@/hooks/useCeloChess'
import { useReadContract } from 'wagmi'
import { CHESS_GAME_ABI } from '@/config/abis'
import { CELO_CONTRACTS, CELO_CHAIN_ID, TOKEN_DECIMALS } from '@/config/contracts'
import ClayCard from '@/components/ui/ClayCard'
import GlowButton from '@/components/ui/GlowButton'
import StatBadge from '@/components/ui/StatBadge'
import LoadingState from '@/components/ui/LoadingState'
import PromotionModal, { PromotionPiece } from '@/components/ui/PromotionModal'
import { Navbar } from '@/components/landing/Hero'
import { getBestMove, getHintMove, getCaptureSummary } from '@/lib/chess-engine'
import { playMoveChime } from '@/lib/audio'
import { useGameMoves } from '@/hooks/useGameMoves'
import { useToastStore } from '@/hooks/useToastStore'
import { useSettingsStore, BOARD_THEMES, AI_DEPTH, type PieceSet } from '@/hooks/useSettingsStore'
import ChessName from '@/components/ui/ChessName'
import ChessAvatar from '@/components/ui/ChessAvatar'
import { useBatchProfiles } from '@/hooks/useBatchProfiles'
import { buildPieces, piecePath } from '@/lib/chessPieces'

const BOT_SAVE_KEY = 'chess-bot-save'

const Chessboard = dynamic(() => import('react-chessboard').then(m => m.Chessboard), { ssr: false })

// ─── types ────────────────────────────────────────────────────────────────────

interface GameData {
  white: string
  black: string
  wager: string
  status: string // '0'=WAITING '1'=ACTIVE '2'=FINISHED '3'=CANCELLED '4'=DRAW
}

// ─── captured-pieces tray ───────────────────────────────────────────────────

function CapturedTray({ pieces, color, advantage, set }: { pieces: string[]; color: 'w' | 'b'; advantage: number; set: PieceSet }) {
  return (
    <div className="flex items-center gap-2 min-h-[22px]">
      <div className="flex items-center">
        {pieces.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- dynamic SVG piece sprite, next/image unsuitable
          <img
            key={i}
            src={piecePath(set, `${color}${p.toUpperCase()}`)}
            alt={p}
            draggable={false}
            className="w-[18px] h-[18px] -mr-1.5 last:mr-0 drop-shadow"
          />
        ))}
      </div>
      {advantage > 0 && (
        <span className="text-[11px] font-black tabular-nums text-[var(--c)]">+{advantage}</span>
      )}
    </div>
  )
}

// ─── component ────────────────────────────────────────────────────────────────

export default function GameClient() {
  const params  = useParams()
  const router  = useRouter()

  const isBotGame = params?.id === 'bot'
  const gameId    = isBotGame ? 0 : Number(params?.id ?? 0)

  const { address: celoAddress, isConnected, connectWallet } = useWallet()
  const { joinGame: joinCelo, resign: resignCelo, reportWin: reportCeloWin } = useCeloChess()
  const showToast = useToastStore((s) => s.showToast)

  // ── chess state ─────────────────────────────────────────────────────────────

  const [game, setGame] = useState<Chess>(() => {
    if (typeof window === 'undefined' || !isBotGame) return new Chess()
    try {
      const saved = localStorage.getItem(BOT_SAVE_KEY)
      if (saved) return new Chess(JSON.parse(saved).fen)
    } catch { /* corrupt */ }
    return new Chess()
  })

  const [moveHistory, setMoveHistory] = useState<string[]>(() => {
    if (typeof window === 'undefined' || !isBotGame) return []
    try {
      const saved = localStorage.getItem(BOT_SAVE_KEY)
      if (saved) { const h = JSON.parse(saved).history; return Array.isArray(h) ? h : [] }
    } catch { /* ignore */ }
    return []
  })

  // Ref so the relay-rebuild effect can read the latest history without
  // being listed as a dependency (avoids a rebuild → setHistory → rebuild loop).
  const moveHistoryRef = useRef(moveHistory)
  useEffect(() => { moveHistoryRef.current = moveHistory }, [moveHistory])

  const [moveFrom, setMoveFrom] = useState('')
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string; to: string; color: 'white' | 'black'
  } | null>(null)

  // ── contract / chain state ──────────────────────────────────────────────────

  const [gameData, setGameData] = useState<GameData | null>(null)
  const [txPending, setTxPending] = useState(false)
  const [loadError, setLoadError] = useState(false)

  // Track end-game actions the local user initiated so we can derive result immediately.
  const [didResign, setDidResign]         = useState(false)
  const [wagerClaimed, setWagerClaimed]   = useState(false)
  const [opponentTimedOut, setOpponentTimedOut] = useState(false)

  // ── opponent turn timer (5 min) ─────────────────────────────────────────────
  const TURN_TIMEOUT_SECS = 300
  const [turnSecondsLeft, setTurnSecondsLeft] = useState(TURN_TIMEOUT_SECS)
  const { soundEnabled: soundOn, setSoundEnabled: setSoundOn, boardTheme, pieceSet, aiDifficulty, showMoveHints } = useSettingsStore()
  const customPieces = useMemo(() => buildPieces(pieceSet), [pieceSet])
  const aiDepth = AI_DEPTH[aiDifficulty]
  const aiDepthRef = useRef(aiDepth)
  useEffect(() => { aiDepthRef.current = aiDepth }, [aiDepth])
  const [hintMove, setHintMove] = useState<{ from: string; to: string } | null>(null)
  const [isHintLoading, setIsHintLoading] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const soundOnRef = useRef(soundOn)
  useEffect(() => { soundOnRef.current = soundOn }, [soundOn])

  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      }
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
      return audioCtxRef.current
    } catch { return null }
  }, [])


  const { data: celoGameData } = useReadContract({
    address: CELO_CONTRACTS.game as `0x${string}`,
    abi: CHESS_GAME_ABI,
    functionName: 'getGame',
    args: [BigInt(gameId)],
    chainId: CELO_CHAIN_ID,
    query: {
      enabled: !isBotGame && gameId > 0,
      refetchInterval: 4_000,
    },
  })

  useEffect(() => {
    if (!celoGameData) return
    const gd = celoGameData as { white: string; black: string; wager: bigint; status: bigint }
    setGameData({
      white:  gd.white,
      black:  gd.black,
      wager:  gd.wager.toString(),
      status: gd.status.toString(),
    })
  }, [celoGameData])

  // ── derived identity ────────────────────────────────────────────────────────

  const ZERO = '0x0000000000000000000000000000000000000000'
  const norm  = (a: string) => (a ?? '').toLowerCase()
  const me    = norm(celoAddress ?? '')

  const isCreator  = !!gameData && norm(gameData.white) === me && me !== ''
  const isOpponent = !!gameData && norm(gameData.black) === me && gameData.black !== '' && gameData.black !== ZERO
  const isParticipant = isCreator || isOpponent

  const myColor: 'white' | 'black' | null = isBotGame ? 'white'
    : isCreator  ? 'white'
    : isOpponent ? 'black'
    : null

  const playerAddrs = gameData
    ? [gameData.white, gameData.black].filter((a) => a && a !== ZERO && a.startsWith('0x'))
    : []
  const { data: gameProfileMap = {} } = useBatchProfiles(playerAddrs)

  const gameIsWaiting   = gameData?.status === '0'
  const contractActive  = gameData?.status === '1'
  const contractDone    = gameData?.status === '2'
  const contractDraw    = gameData?.status === '4'
  const canJoinFromPage = gameIsWaiting && !isParticipant && !isBotGame && isConnected

  const STATUS_LABELS: Record<string, string> = {
    '0': 'WAITING', '1': 'ACTIVE', '2': 'FINISHED', '3': 'CANCELLED', '4': 'DRAW',
  }
  const wagerFormatted = gameData
    ? (Number(gameData.wager) / Math.pow(10, TOKEN_DECIMALS)).toFixed(0)
    : '0'
  const statusLabel = gameData ? (STATUS_LABELS[gameData.status] ?? 'UNKNOWN') : ''

  // ── board state ─────────────────────────────────────────────────────────────

  const gameOver  = game.isGameOver()
  const turn      = game.turn()
  const isMyTurn  = isBotGame
    ? turn === 'w'
    : (turn === 'w' && myColor === 'white') || (turn === 'b' && myColor === 'black')

  // canAct: bot always ok; PvP needs connection + participant status
  const canAct = isBotGame ? !txPending : isConnected && !txPending && isParticipant

  // ── captured pieces / material balance ────────────────────────────────────────
  const captureSummary = getCaptureSummary(game.board())
  const iAmWhite = (myColor ?? 'white') === 'white'
  const myCaptured  = iAmWhite ? captureSummary.whiteCaptured : captureSummary.blackCaptured
  const oppCaptured = iAmWhite ? captureSummary.blackCaptured : captureSummary.whiteCaptured
  const myAdvantage = iAmWhite ? captureSummary.advantage : -captureSummary.advantage

  // ── game result derivation ──────────────────────────────────────────────────

  // Who is in checkmate? chess.js leaves it on the LOSER's turn.
  const loserSide = game.isCheckmate() ? turn : null  // 'w' or 'b'
  const iWonByCheckmate  = !!loserSide && ((loserSide === 'w' && myColor === 'black') || (loserSide === 'b' && myColor === 'white'))
  const iLostByCheckmate = !!loserSide && ((loserSide === 'w' && myColor === 'white') || (loserSide === 'b' && myColor === 'black'))

  let gameResult: 'won' | 'lost' | 'draw' | null = null
  if (isBotGame) {
    // Bot result handled separately in sidebar; no overlay needed.
  } else if (isParticipant) {
    if (iWonByCheckmate)  gameResult = 'won'
    else if (iLostByCheckmate) gameResult = 'lost'
    else if (didResign)   gameResult = 'lost'
    else if (game.isDraw() || game.isStalemate() || contractDraw) gameResult = 'draw'
    else if (opponentTimedOut) gameResult = 'won'
    // Contract FINISHED but board not over → opponent resigned / was timed out
    else if (contractDone && !didResign) gameResult = 'won'
  }

  const resultMessage = gameResult === 'won'
    ? (opponentTimedOut ? 'Opponent exceeded the 5-minute turn limit.'
      : iWonByCheckmate ? 'Checkmate — the King has fallen.'
      : 'Opponent forfeited the match.')
    : gameResult === 'lost'
    ? (iLostByCheckmate ? 'Your King has fallen.' : 'You resigned from the match.')
    : 'Tactical deadlock — neither side can proceed.'

  // ── relay ───────────────────────────────────────────────────────────────────

  const {
    moves: relayMoves,
    submitMove: relaySubmitMove,
    error: relayError,
  } = useGameMoves({
    chain: 'celo',
    gameId,
    enabled: !isBotGame && gameId > 0,
  })

  // Rebuild board from relay. Uses moveHistoryRef (not moveHistory) to avoid
  // the dependency causing an infinite rebuild → setState → rebuild cycle.
  useEffect(() => {
    if (isBotGame || relayMoves.length === 0) return

    const replayed = new Chess()
    const sanHistory: string[] = []
    for (const m of relayMoves) {
      const result = replayed.move(m.san)
      if (!result) {
        console.error('[GameClient] relay move rejected — aborting replay', m)
        return
      }
      sanHistory.push(result.san)
    }

    const prev = moveHistoryRef.current
    const same = sanHistory.length === prev.length && sanHistory.every((s, i) => s === prev[i])
    if (same) return

    setGame(new Chess(replayed.fen()))
    setMoveHistory(sanHistory)
    if (soundOnRef.current && sanHistory.length === prev.length + 1) {
      const ctx = getCtx()
      if (ctx) playMoveChime(ctx, true)
    }

    if (replayed.isCheckmate()) showToast('The King has fallen. End of line.', 'checkmate')
    else if (replayed.inCheck()) showToast('King under direct assault — parry or evade!', 'check')
    else if (replayed.isDraw() || replayed.isStalemate()) showToast('Tactical deadlock — neither commander can proceed.', 'draw')
  }, [relayMoves, isBotGame, showToast, getCtx]) // moveHistory intentionally omitted — read via ref

  // ── opponent turn timer ─────────────────────────────────────────────────────

  // Reset to 5 min on every new relay move (covers both my move and opponent's)
  useEffect(() => {
    if (isBotGame) return
    setTurnSecondsLeft(TURN_TIMEOUT_SECS)
    setOpponentTimedOut(false)
  }, [relayMoves.length, isBotGame]) // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown — only ticks when it's opponent's turn and game is live
  useEffect(() => {
    if (isBotGame || isMyTurn || gameOver || !contractActive || opponentTimedOut) return
    const t = setInterval(() => setTurnSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [isBotGame, isMyTurn, gameOver, contractActive, opponentTimedOut])

  // Expiry → auto-show win overlay
  useEffect(() => {
    if (isBotGame || isMyTurn || turnSecondsLeft > 0 || opponentTimedOut || !contractActive) return
    setOpponentTimedOut(true)
    showToast('Opponent exceeded the 5-minute turn limit. Claim your win.', 'info', 6000)
  }, [turnSecondsLeft, isBotGame, isMyTurn, opponentTimedOut, contractActive, showToast])

  // ── bot timer cleanup ────────────────────────────────────────────────────────

  const botReplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (botReplyTimerRef.current) clearTimeout(botReplyTimerRef.current)
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
  }, [])

  const handleHint = useCallback(() => {
    if (isHintLoading || gameOver) return
    setIsHintLoading(true)
    if (hintTimerRef.current) { clearTimeout(hintTimerRef.current); hintTimerRef.current = null }
    setTimeout(() => {
      const clone = new Chess(game.fen())
      const hint = getHintMove(clone, 3)
      setIsHintLoading(false)
      if (hint) {
        setHintMove({ from: hint.from, to: hint.to })
        hintTimerRef.current = setTimeout(() => setHintMove(null), 6000)
      }
    }, 0)
  }, [game, isHintLoading, gameOver])

  const resetBotGame = useCallback(() => {
    if (botReplyTimerRef.current) { clearTimeout(botReplyTimerRef.current); botReplyTimerRef.current = null }
    localStorage.removeItem(BOT_SAVE_KEY)
    setGame(new Chess())
    setMoveHistory([])
    setMoveFrom('')
  }, [])

  // ── move execution ───────────────────────────────────────────────────────────

  const executeMove = useCallback((src: string, tgt: string, promotion?: PromotionPiece): boolean => {
    try {
      // Promotion detection — defer to modal
      if (!promotion) {
        const legals = game.moves({ square: src as Square, verbose: true }) as Move[]
        if (legals.find((m) => m.to === tgt && m.promotion)) {
          setPendingPromotion({ from: src, to: tgt, color: game.turn() === 'w' ? 'white' : 'black' })
          return true
        }
      }

      const next = new Chess(game.fen())
      const move = next.move({ from: src, to: tgt, promotion: promotion ?? 'q' })
      if (!move) {
        showToast(
          game.inCheck() ? 'Your King is in check — resolve it first.' : "You can't move there.",
          'invalid'
        )
        return false
      }

      setGame(next)
      const newHistory = [...moveHistoryRef.current, move.san]
      setMoveHistory(newHistory)
      setHintMove(null)
      if (soundOnRef.current) { const ctx = getCtx(); if (ctx) playMoveChime(ctx, false) }

      // Persist bot state
      if (isBotGame) {
        try { localStorage.setItem(BOT_SAVE_KEY, JSON.stringify({ fen: next.fen(), history: newHistory })) } catch { /* quota */ }
      }

      // Game-over toasts
      if (next.isCheckmate()) {
        showToast('The King has fallen. End of line.', 'checkmate')
        if (isBotGame) localStorage.removeItem(BOT_SAVE_KEY)
      } else if (next.inCheck()) {
        showToast('King under direct assault — parry or evade!', 'check')
      } else if (next.isDraw() || next.isStalemate()) {
        showToast('Tactical deadlock — neither commander can proceed.', 'draw')
        if (isBotGame) localStorage.removeItem(BOT_SAVE_KEY)
      }

      // PvP: relay only — no on-chain tx per move
      if (!isBotGame) {
        const player = celoAddress ?? ''
        void relaySubmitMove(move.san, player).then((ok) => {
          if (!ok) showToast('Move conflict with opponent — resyncing board.', 'invalid')
        })
      }

      // Bot reply
      if (isBotGame && !next.isGameOver()) {
        if (botReplyTimerRef.current) clearTimeout(botReplyTimerRef.current)
        botReplyTimerRef.current = setTimeout(() => {
          botReplyTimerRef.current = null
          const after = new Chess(next.fen())
          const botMove = getBestMove(after, aiDepthRef.current)
          if (!botMove) return
          after.move(botMove)
          const fen = after.fen()
          setGame(new Chess(fen))
          setMoveHistory(h => {
            const updated = [...h, botMove.san]
            try { localStorage.setItem(BOT_SAVE_KEY, JSON.stringify({ fen, history: updated })) } catch { /* quota */ }
            return updated
          })
          if (after.isCheckmate()) { showToast('The King has fallen. End of line.', 'checkmate'); localStorage.removeItem(BOT_SAVE_KEY) }
          else if (after.inCheck()) showToast('King under direct assault — parry or evade!', 'check')
          else if (after.isDraw() || after.isStalemate()) { showToast('Tactical deadlock.', 'draw'); localStorage.removeItem(BOT_SAVE_KEY) }
        }, 1200)
      }
      return true
    } catch (e) {
      console.error('[GameClient] executeMove failed:', e)
      showToast(game.inCheck() ? 'Your King is in check — resolve it first.' : "You can't move there.", 'invalid')
      return false
    }
  }, [game, isBotGame, celoAddress, relaySubmitMove, showToast, getCtx])

  // ── board event handlers ─────────────────────────────────────────────────────

  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: { piece: unknown; sourceSquare: string; targetSquare: string | null }) => {
      if (!targetSquare) return false
      return executeMove(sourceSquare, targetSquare)
    },
    [executeMove]
  )

  const handleSquareClick = useCallback(
    ({ square }: { piece: unknown; square: string }) => {
      if (!canAct || gameOver) return
      if (isBotGame && game.turn() === 'b') return
      if (!isBotGame && !isMyTurn) return

      if (!moveFrom) {
        const piece = game.get(square as Square)
        if (piece && piece.color === game.turn()) setMoveFrom(square)
        return
      }

      const piece = game.get(square as Square)
      if (piece && piece.color === game.turn()) { setMoveFrom(square); return }

      executeMove(moveFrom, square)
      setMoveFrom('')
    },
    [canAct, gameOver, game, moveFrom, executeMove, isBotGame, isMyTurn]
  )

  const handleCanDragPiece = useCallback(
    ({ square }: { isSparePiece: boolean; piece: unknown; square: string | null }) => {
      if (!canAct || gameOver || !square) return false
      if (isBotGame && game.turn() === 'b') return false
      if (!isBotGame && !isMyTurn) return false
      const piece = game.get(square as Square)
      return !!piece && piece.color === game.turn()
    },
    [canAct, gameOver, isBotGame, isMyTurn, game]
  )

  const handlePromotionSelect = useCallback((piece: PromotionPiece) => {
    if (!pendingPromotion) return
    const { from, to } = pendingPromotion
    setPendingPromotion(null)
    executeMove(from, to, piece)
  }, [pendingPromotion, executeMove])

  // ── tx helpers ───────────────────────────────────────────────────────────────

  const withTx = useCallback(async (fn: () => Promise<unknown>) => {
    if (txPending) return
    setTxPending(true)
    try { await fn() } catch (e) { console.error('[GameClient] tx error:', e) } finally { setTxPending(false) }
  }, [txPending])

  const handleResign = () => withTx(async () => {
    await resignCelo(gameId)
    setDidResign(true)
  })

  const handleReportWin = () => withTx(async () => {
    await reportCeloWin(gameId)
    setWagerClaimed(true)
  })

  const handleJoinMatch = () => {
    if (!gameData) return
    withTx(async () => {
      const wager = Number(gameData.wager) / Math.pow(10, TOKEN_DECIMALS)
      await joinCelo(gameId, wager)
    })
  }

  // ── load timeout ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isBotGame || gameData) return
    const t = setTimeout(() => setLoadError(true), 8_000)
    return () => clearTimeout(t)
  }, [isBotGame, gameData])

  // ── render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--t1)]">
      <Navbar />

      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[10%] right-[10%] w-[30%] h-[30%] bg-[var(--c)] blur-[120px] rounded-full opacity-[0.04]" />
        <div className="absolute bottom-[10%] left-[10%] w-[30%] h-[30%] bg-[#783cdc] blur-[120px] rounded-full opacity-[0.03]" />
      </div>

      {!isBotGame && !gameData ? (
        /* ── Loading / not found ── */
        <div className="min-h-screen flex flex-col items-center justify-center gap-8 relative z-10">
          <LoadingState message={loadError ? `MATCH #${gameId} NOT FOUND` : `RETRIEVING MATCH #${gameId}`} />
          {loadError && (
            <p className="text-[var(--t3)] text-xs font-bold tracking-widest text-center max-w-sm -mt-4">
              Match not found on Celo. Check the ID and try again.
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
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter" style={{ fontFamily: 'var(--fd)' }}>
                {isBotGame ? <>AI <span style={{ color: 'var(--c)' }}>Training</span></> : <>Match <span style={{ color: 'var(--c)' }}>#{gameId}</span></>}
              </h1>
              {isBotGame ? (
                <div className="flex gap-4 mt-4">
                  <StatBadge label="MODE" value="SINGLE PLAYER" accent />
                  <StatBadge label="OPPONENT" value="SYSTEM BOT" />
                </div>
              ) : gameData && (
                <>
                  <div className="flex flex-wrap gap-4 mt-4">
                    <StatBadge label="WAGER" value={`${wagerFormatted} CHESS`} accent />
                    <StatBadge label="STATUS" value={statusLabel} />
                    {myColor && <StatBadge label="YOU PLAY" value={myColor.toUpperCase()} />}
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <div className="flex items-center gap-2">
                      <ChessAvatar address={gameData.white} size={24} />
                      <ChessName
                        address={gameData.white}
                        profile={gameProfileMap[gameData.white.toLowerCase()]}
                        short
                        className="text-xs font-bold text-white/80"
                      />
                    </div>
                    <span className="text-[var(--t3)] text-xs font-black">vs</span>
                    {gameData.black && gameData.black !== ZERO ? (
                      <div className="flex items-center gap-2">
                        <ChessAvatar address={gameData.black} size={24} />
                        <ChessName
                          address={gameData.black}
                          profile={gameProfileMap[gameData.black.toLowerCase()]}
                          short
                          className="text-xs font-bold text-white/80"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--t3)] italic">waiting…</span>
                    )}
                  </div>
                </>
              )}
            </div>
            <Link href="/app/lobby">
              <GlowButton variant="ghost" size="sm" parallelogram>← BACK TO LOBBY</GlowButton>
            </Link>
          </div>

          {/* ── board + sidebar ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Board */}
            <div className="lg:col-span-8">
              <ClayCard className="p-4 md:p-8 relative overflow-hidden">
                <div className="absolute -right-10 -bottom-10 opacity-[0.025] rotate-12 pointer-events-none">
                  <svg width="300" height="300" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19,22H5V20H19V22M17,10C17,8.9 16.1,8 15,8V7C15,5.34 13.66,4 12,4C10.34,4 9,5.34 9,7V8C7.9,8 7,8.9 7,10V11H17V10M15,13H9V18H15V13Z" />
                  </svg>
                </div>

                <div className="max-w-[600px] mx-auto">
                  {/* Opponent's captures (pieces they've taken from you) */}
                  <div className="mb-2 px-1">
                    <CapturedTray pieces={oppCaptured} color={iAmWhite ? 'w' : 'b'} advantage={-myAdvantage} set={pieceSet} />
                  </div>
                  <div className="aspect-square">
                  <Chessboard
                    options={{
                      id: 'board',
                      position: game.fen(),
                      pieces: customPieces,
                      boardOrientation: myColor === 'black' ? 'black' : 'white',
                      allowDragging: canAct && !gameOver && (isBotGame ? turn === 'w' : isMyTurn),
                      canDragPiece: handleCanDragPiece,
                      onPieceDrop: handlePieceDrop,
                      onSquareClick: handleSquareClick,
                      darkSquareStyle: { backgroundColor: BOARD_THEMES[boardTheme].dark },
                      lightSquareStyle: { backgroundColor: BOARD_THEMES[boardTheme].light },
                      squareStyles: (() => {
                        const styles: Record<string, React.CSSProperties> = {}
                        if (moveFrom) {
                          styles[moveFrom] = { backgroundColor: 'rgba(0,204,255,0.35)' }
                          if (showMoveHints) {
                            const legalMoves = game.moves({ square: moveFrom as Square, verbose: true }) as Array<{ to: string; flags: string }>
                            legalMoves.forEach(({ to, flags }) => {
                              const isCapture = flags.includes('c') || flags.includes('e')
                              styles[to] = isCapture
                                ? { boxShadow: 'inset 0 0 0 3px rgba(74,222,128,0.7)', borderRadius: '4px' }
                                : { background: 'radial-gradient(circle, rgba(74,222,128,0.7) 30%, transparent 32%)' }
                            })
                          }
                        }
                        if (hintMove) {
                          styles[hintMove.from] = { backgroundColor: 'rgba(251,191,36,0.35)' }
                          styles[hintMove.to] = { background: 'radial-gradient(circle, rgba(251,191,36,0.65) 30%, transparent 32%)' }
                        }
                        return styles
                      })(),
                      boardStyle: { borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' },
                    }}
                  />
                  </div>
                  {/* Your captures (pieces you've taken) */}
                  <div className="mt-2 px-1">
                    <CapturedTray pieces={myCaptured} color={iAmWhite ? 'b' : 'w'} advantage={myAdvantage} set={pieceSet} />
                  </div>
                </div>

                {/* Turn bar */}
                <div className="mt-6 text-center">
                  {gameOver ? (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-[var(--c)]/10 border border-[var(--c)]/30"
                    >
                      <span className="text-[var(--c)] font-black uppercase tracking-widest text-sm">
                        {game.isCheckmate() ? 'Checkmate' : game.isStalemate() ? 'Stalemate' : 'Game Over'}
                      </span>
                    </motion.div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <div className={`w-3 h-3 rounded-full transition-colors duration-300 ${
                        turn === 'w' ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]' : 'bg-slate-600'
                      }`} />
                      <span className="text-sm font-bold tracking-widest text-[var(--t3)] uppercase">
                        {isBotGame
                          ? (turn === 'w' ? 'Your turn' : 'Bot thinking…')
                          : isMyTurn ? 'Your turn' : "Opponent's turn"}
                      </span>
                      <div className={`w-3 h-3 rounded-full transition-colors duration-300 ${
                        turn === 'b' ? 'bg-slate-300 shadow-[0_0_10px_rgba(200,200,200,0.6)]' : 'bg-slate-700'
                      }`} />
                    </div>
                  )}
                </div>

                {/* Sound toggle */}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setSoundOn(!soundOn)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] border transition-colors"
                    style={{
                      borderColor: soundOn ? 'rgba(0,204,255,0.3)' : 'rgba(255,255,255,0.08)',
                      color: soundOn ? 'var(--c)' : 'var(--t3)',
                      background: soundOn ? 'rgba(0,204,255,0.06)' : 'transparent',
                    }}
                  >
                    {soundOn ? (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                      </svg>
                    ) : (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                      </svg>
                    )}
                    {soundOn ? 'SOUND' : 'MUTED'}
                  </button>
                </div>
              </ClayCard>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-4">

              {/* Context-aware action area */}
              {canJoinFromPage ? (
                <ClayCard className="p-6">
                  <p className="text-[10px] font-black tracking-[0.2em] text-[var(--t3)] uppercase mb-3">Open Challenge</p>
                  <p className="text-xs text-[var(--t2)] mb-1">
                    Wager: <span className="text-[var(--c)] font-black">{(Number(gameData?.wager ?? 0) / Math.pow(10, TOKEN_DECIMALS)).toFixed(0)} CHESS</span>
                  </p>
                  <p className="text-[10px] text-[var(--t3)] mb-5 leading-relaxed">Accepting locks the matching wager from your wallet.</p>
                  <GlowButton variant="brand" fullWidth parallelogram loading={txPending} onClick={handleJoinMatch}>
                    CONFIRM JOIN
                  </GlowButton>
                </ClayCard>

              ) : gameIsWaiting && isCreator ? (
                <ClayCard className="p-6">
                  <p className="text-[10px] font-black tracking-[0.2em] text-[var(--t3)] uppercase mb-3">Waiting for Opponent</p>
                  <p className="text-xs text-[var(--t2)] mb-4 leading-relaxed">Share your match ID so they can join.</p>
                  <div className="flex items-center gap-2 bg-black/40 rounded-xl p-3 border border-white/10 mb-5">
                    <span className="text-2xl font-black text-[var(--c)] tracking-widest flex-1 text-center" style={{ fontFamily: 'var(--fd)' }}>
                      #{gameId}
                    </span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(String(gameId)); showToast('Match ID copied!', 'info') }}
                      className="text-[9px] font-black tracking-widest uppercase text-[var(--t3)] hover:text-[var(--c)] transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                    >
                      COPY
                    </button>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--c)] animate-pulse" />
                    <span className="text-[10px] text-[var(--t3)] tracking-widest uppercase font-bold">Watching for opponent…</span>
                  </div>
                </ClayCard>

              ) : isBotGame ? (
                <ClayCard className="p-6">
                  <p className="text-[10px] font-black tracking-[0.2em] text-[var(--t3)] uppercase mb-4">Training Session</p>
                  <div className="space-y-3">
                    <GlowButton variant="brand" fullWidth parallelogram onClick={resetBotGame}>
                      {gameOver ? 'PLAY AGAIN' : 'NEW GAME'}
                    </GlowButton>
                    {!gameOver && turn === 'w' && (
                      <GlowButton variant="ghost" fullWidth parallelogram onClick={handleHint} disabled={isHintLoading}>
                        {isHintLoading ? 'ANALYSING…' : hintMove ? `HINT: ${hintMove.from.toUpperCase()} → ${hintMove.to.toUpperCase()}` : 'GET HINT'}
                      </GlowButton>
                    )}
                    <p className="text-[10px] text-[var(--t3)] text-center leading-relaxed">
                      {gameOver ? 'Game over — start a fresh match.' : 'Progress saved on reload.'}
                    </p>
                  </div>
                </ClayCard>

              ) : (
                /* PvP active game */
                <>
                  {/* Turn state */}
                  {!gameOver && contractActive && (
                    <ClayCard className="p-5">
                      {isMyTurn ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_#4ade80]" />
                            <span className="text-[10px] font-black tracking-[0.2em] text-green-400 uppercase">Your Turn</span>
                          </div>
                          <p className="text-[11px] text-[var(--t3)] leading-relaxed">
                            Drag or click a piece to move. Opponent sees it automatically.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <span className="text-[10px] font-black tracking-[0.2em] text-amber-400 uppercase">Opponent&apos;s Turn</span>
                          </div>
                          <p className="text-[11px] text-[var(--t3)] leading-relaxed">Waiting for their move…</p>
                          {/* Countdown */}
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[9px] text-[var(--t3)] uppercase font-bold tracking-widest">Time limit</span>
                            <span className={`text-sm font-black font-mono tabular-nums ${
                              turnSecondsLeft < 60 ? 'text-red-400' : turnSecondsLeft < 120 ? 'text-amber-400' : 'text-[var(--t2)]'
                            }`}>
                              {Math.floor(turnSecondsLeft / 60)}:{String(turnSecondsLeft % 60).padStart(2, '0')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
                            <div className={`w-1.5 h-1.5 rounded-full ${relayError ? 'bg-red-400' : 'bg-[var(--c)] animate-pulse'}`} />
                            <span className={`text-[9px] font-bold tracking-widest uppercase ${relayError ? 'text-red-400' : 'text-[var(--c)]'}`}>
                              {relayError ? 'Relay offline' : 'Live sync active'}
                            </span>
                          </div>
                        </div>
                      )}
                    </ClayCard>
                  )}

                  {/* Hint */}
                  {contractActive && !gameOver && isMyTurn && (
                    <ClayCard className="p-5">
                      <p className="text-[10px] font-black tracking-[0.2em] text-[var(--t3)] uppercase mb-3">Analysis</p>
                      <GlowButton variant="ghost" fullWidth onClick={handleHint} disabled={isHintLoading}>
                        {isHintLoading ? 'ANALYSING…' : hintMove ? `HINT: ${hintMove.from.toUpperCase()} → ${hintMove.to.toUpperCase()}` : 'GET HINT'}
                      </GlowButton>
                      {hintMove && (
                        <p className="text-[9px] text-green-400 font-bold tracking-widest uppercase text-center mt-2 opacity-70">
                          Green squares show best move
                        </p>
                      )}
                    </ClayCard>
                  )}

                  {/* Resign — only available during active play */}
                  {contractActive && !gameOver && (
                    <ClayCard className="p-5">
                      <p className="text-[10px] font-black tracking-[0.2em] text-[var(--t3)] uppercase mb-3">Forfeit</p>
                      <GlowButton
                        variant="ghost"
                        fullWidth
                        disabled={!canAct}
                        loading={txPending}
                        className="text-red-400 !border-red-500/20 hover:!bg-red-500/10"
                        onClick={handleResign}
                      >
                        RESIGN
                      </GlowButton>
                      <p className="text-[9px] text-[var(--t3)] text-center mt-2 opacity-50">
                        Concedes the match and forfeits your wager.
                      </p>
                    </ClayCard>
                  )}
                </>
              )}

              {/* Move log */}
              <ClayCard variant="inset" className="p-5">
                <p className="text-[10px] font-black tracking-[0.2em] text-[var(--t3)] uppercase mb-3">Move Log</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                  {moveHistory.map((san, i) => (
                    <div key={i} className={`flex items-center gap-2 text-xs font-mono p-1.5 rounded-lg ${i % 2 === 0 ? 'bg-white/5' : ''}`}>
                      <span className="text-[var(--t3)] w-5 text-left shrink-0">{Math.floor(i / 2) + 1}.</span>
                      <span className={i % 2 === 0 ? 'text-[var(--t1)]' : 'text-[var(--t2)]'}>{san}</span>
                    </div>
                  ))}
                  {moveHistory.length === 0 && (
                    <p className="col-span-2 text-center text-xs text-[var(--t3)] py-4">Waiting for first move…</p>
                  )}
                </div>
              </ClayCard>

              {/* Wallet connect nudge */}
              {!isBotGame && !isConnected && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-center flex flex-col gap-3 items-center"
                >
                  <span className="text-yellow-200/70 text-[10px] uppercase font-bold tracking-widest">Wallet required</span>
                  <GlowButton variant="brand" size="sm" onClick={connectWallet}>CONNECT WALLET</GlowButton>
                </motion.div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* ── Game Result Overlay ── */}
      <AnimatePresence>
        {gameResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: 'rgba(6,6,15,0.88)', backdropFilter: 'blur(12px)' }}
          >
            <motion.div
              initial={{ scale: 0.88, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 200 }}
              className="w-full max-w-md rounded-[32px] border overflow-hidden"
              style={{
                background: gameResult === 'won'
                  ? 'linear-gradient(145deg,rgba(0,204,255,0.1) 0%,rgba(6,6,15,0.97) 60%)'
                  : gameResult === 'lost'
                  ? 'linear-gradient(145deg,rgba(239,68,68,0.1) 0%,rgba(6,6,15,0.97) 60%)'
                  : 'linear-gradient(145deg,rgba(99,102,241,0.1) 0%,rgba(6,6,15,0.97) 60%)',
                borderColor: gameResult === 'won'
                  ? 'rgba(0,204,255,0.25)'
                  : gameResult === 'lost'
                  ? 'rgba(239,68,68,0.25)'
                  : 'rgba(99,102,241,0.25)',
                boxShadow: gameResult === 'won'
                  ? '0 0 80px rgba(0,204,255,0.15), 0 40px 80px rgba(0,0,0,0.6)'
                  : gameResult === 'lost'
                  ? '0 0 80px rgba(239,68,68,0.12), 0 40px 80px rgba(0,0,0,0.6)'
                  : '0 40px 80px rgba(0,0,0,0.6)',
              }}
            >
              <div className="p-10 flex flex-col items-center gap-6 text-center">

                {/* Icon */}
                <div
                  className="text-7xl leading-none"
                  style={{ filter: gameResult === 'won' ? 'drop-shadow(0 0 20px rgba(0,204,255,0.5))' : 'none' }}
                >
                  {gameResult === 'won' ? '♛' : gameResult === 'lost' ? '♚' : '♟'}
                </div>

                {/* Result label */}
                <div>
                  <p
                    className="text-[10px] font-black tracking-[0.5em] uppercase mb-3"
                    style={{
                      color: gameResult === 'won' ? 'var(--c)' : gameResult === 'lost' ? '#ef4444' : '#818cf8',
                    }}
                  >
                    {gameResult === 'won' ? 'VICTORY' : gameResult === 'lost' ? 'DEFEAT' : 'DRAW'}
                  </p>
                  <h2
                    className="text-5xl font-black uppercase tracking-tighter leading-none"
                    style={{ fontFamily: 'var(--fd)' }}
                  >
                    {gameResult === 'won' ? 'You Won' : gameResult === 'lost' ? 'You Lost' : 'Stalemate'}
                  </h2>
                  <p className="text-sm text-[var(--t3)] mt-3 leading-relaxed">{resultMessage}</p>
                </div>

                {/* Wager chip */}
                {gameData && (
                  <div className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10">
                    <p className="text-[9px] text-[var(--t3)] uppercase tracking-widest mb-1">Wager</p>
                    <p
                      className="text-2xl font-black"
                      style={{ fontFamily: 'var(--fd)', color: 'var(--c)' }}
                    >
                      {wagerFormatted} <span className="text-base">CHESS</span>
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-3 w-full">
                  {gameResult === 'won' && !wagerClaimed && (
                    <GlowButton
                      variant="brand"
                      fullWidth
                      parallelogram
                      loading={txPending}
                      onClick={handleReportWin}
                    >
                      CLAIM {wagerFormatted} CHESS
                    </GlowButton>
                  )}
                  {wagerClaimed && (
                    <div className="flex items-center justify-center gap-2 py-2">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="text-green-400 text-xs font-black tracking-widest uppercase">Winnings Claimed</span>
                    </div>
                  )}
                  <GlowButton variant="ghost" fullWidth onClick={() => router.push('/app/lobby')}>
                    BACK TO LOBBY
                  </GlowButton>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PromotionModal
        open={!!pendingPromotion}
        color={pendingPromotion?.color ?? 'white'}
        onSelect={handlePromotionSelect}
        onCancel={() => setPendingPromotion(null)}
      />
    </div>
  )
}
