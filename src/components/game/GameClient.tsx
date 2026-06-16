'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Chess, type Square, type Move } from 'chess.js'
import Link from 'next/link'
import { useWallet } from '@/components/wallet-provider'
import { useCeloChess } from '@/hooks/useCeloChess'
import { useMoveSigner } from '@/hooks/useMoveSigner'
import GlowButton from '@/components/ui/GlowButton'
import LoadingState from '@/components/ui/LoadingState'
import PromotionModal, { PromotionPiece } from '@/components/ui/PromotionModal'
import { Navbar } from '@/components/landing/Hero'
import { getBestMove, getHintMove, getCaptureSummary } from '@/lib/chess-engine'
import { playMoveChime } from '@/lib/audio'
import { useGameMoves } from '@/hooks/useGameMoves'
import { useToastStore } from '@/hooks/useToastStore'
import { useSettingsStore, AI_DEPTH } from '@/hooks/useSettingsStore'
import { buildPieces } from '@/lib/chessPieces'
import { useGameData } from '@/hooks/useGameData'
import AmbientBackground from './AmbientBackground'
import GameHeader from './GameHeader'
import BoardPanel from './BoardPanel'
import GameSidebar from './GameSidebar'
import GameActionBar from './GameActionBar'
import GameResultOverlay from './GameResultOverlay'
import { BOT_SAVE_KEY, TURN_TIMEOUT_SECS, type GameResult } from './types'

export default function GameClient() {
  const params  = useParams()
  const router  = useRouter()

  const isBotGame = params?.id === 'bot'
  const gameId    = isBotGame ? 0 : Number(params?.id ?? 0)

  const { address: celoAddress, playerAddress, isConnected, connectWallet } = useWallet()
  const { joinGame: joinCelo, resign: resignCelo, proposeDraw: proposeDrawCelo, acceptDraw: acceptDrawCelo, requestSettle } = useCeloChess()
  const { signMove } = useMoveSigner()
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

  const [txPending, setTxPending] = useState(false)
  const [loadError, setLoadError] = useState(false)

  // Track end-game actions the local user initiated so we can derive result immediately.
  const [didResign, setDidResign]         = useState(false)
  const [opponentTimedOut, setOpponentTimedOut] = useState(false)

  // On-chain game record + all derived identity/status flags.
  const {
    gameData, isCreator, isParticipant, myColor,
    iProposedDraw, opponentProposedDraw,
    gameIsWaiting, contractActive, contractDone, contractDraw, payoutSettled, canJoinFromPage,
    wagerFormatted, statusLabel, gameProfileMap,
  } = useGameData({ gameId, isBotGame, celoAddress, isConnected })

  // ── opponent turn timer (5 min) ─────────────────────────────────────────────
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

  let gameResult: GameResult = null
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
  }, [relayMoves.length, isBotGame])

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

      // PvP: relay only — no on-chain tx per move. Use the on-chain identity
      // (playerAddress) so it matches white/black, and sign the move where the
      // wallet can (Tier A/C); MiniPay submits unsigned.
      if (!isBotGame) {
        const player = playerAddress ?? celoAddress ?? ''
        void relaySubmitMove(move.san, player, next.fen(), signMove).then((ok) => {
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
  }, [game, isBotGame, celoAddress, playerAddress, signMove, relaySubmitMove, showToast, getCtx])

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

  const handleProposeDraw = () => withTx(async () => {
    await proposeDrawCelo(gameId)
  })

  const handleAcceptDraw = () => withTx(async () => {
    await acceptDrawCelo(gameId)
  })

  // Auto-settle: once the board is terminal (or the opponent timed out) for a live
  // on-chain game, ask the server to settle via the oracle. Idempotent and safe for
  // both clients; a useRef guard stops this client from spamming the endpoint, and a
  // failed request clears the guard so it can retry.
  const settleRequestedRef = useRef(false)
  useEffect(() => {
    if (isBotGame || !isParticipant || !contractActive) return
    const terminal = gameOver || opponentTimedOut
    if (!terminal || settleRequestedRef.current) return
    settleRequestedRef.current = true
    requestSettle(gameId).then((ok) => {
      if (!ok) settleRequestedRef.current = false
    })
  }, [isBotGame, isParticipant, contractActive, gameOver, opponentTimedOut, gameId, requestSettle])

  const handleJoinMatch = () => {
    if (!gameData) return
    withTx(async () => {
      const wager = Number(wagerFormatted)
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
      <AmbientBackground />

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
        <main className="relative z-10 max-w-7xl mx-auto px-2 sm:px-6 py-6 md:py-12 pt-20 md:pt-32 overflow-x-clip">

          <GameHeader
            isBotGame={isBotGame}
            gameId={gameId}
            gameData={gameData}
            wagerFormatted={wagerFormatted}
            statusLabel={statusLabel}
            myColor={myColor}
            gameProfileMap={gameProfileMap}
          />

          {/* ── board + sidebar ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8 items-start">

            <div className="lg:col-span-8">
              <BoardPanel
                game={game}
                customPieces={customPieces}
                myColor={myColor}
                canAct={canAct}
                gameOver={gameOver}
                isBotGame={isBotGame}
                turn={turn}
                isMyTurn={isMyTurn}
                moveFrom={moveFrom}
                hintMove={hintMove}
                showMoveHints={showMoveHints}
                boardTheme={boardTheme}
                pieceSet={pieceSet}
                iAmWhite={iAmWhite}
                myCaptured={myCaptured}
                oppCaptured={oppCaptured}
                myAdvantage={myAdvantage}
                soundOn={soundOn}
                setSoundOn={setSoundOn}
                handleCanDragPiece={handleCanDragPiece}
                handlePieceDrop={handlePieceDrop}
                handleSquareClick={handleSquareClick}
              />
            </div>

            <GameSidebar
              canJoinFromPage={canJoinFromPage}
              gameIsWaiting={gameIsWaiting}
              isCreator={isCreator}
              isBotGame={isBotGame}
              gameOver={gameOver}
              contractActive={contractActive}
              isMyTurn={isMyTurn}
              isConnected={isConnected}
              canAct={canAct}
              iProposedDraw={iProposedDraw}
              opponentProposedDraw={opponentProposedDraw}
              gameData={gameData}
              gameId={gameId}
              txPending={txPending}
              turn={turn}
              turnSecondsLeft={turnSecondsLeft}
              relayError={relayError}
              hintMove={hintMove}
              isHintLoading={isHintLoading}
              moveHistory={moveHistory}
              onJoinMatch={handleJoinMatch}
              onResetBot={resetBotGame}
              onHint={handleHint}
              onProposeDraw={handleProposeDraw}
              onAcceptDraw={handleAcceptDraw}
              onResign={handleResign}
              onConnectWallet={connectWallet}
            />
          </div>

          {/* Bottom clearance so the fixed mobile action bar never covers content */}
          <div aria-hidden className="md:hidden" style={{ height: 'calc(var(--bottom-nav-h) + env(safe-area-inset-bottom) + 12px)' }} />

          {/* Fixed mobile game bar — replaces the bottom nav during gameplay */}
          <GameActionBar
            gameOver={gameOver}
            hintDisabled={gameOver || (isBotGame ? turn !== 'w' : !(contractActive && isMyTurn))}
            isHintLoading={isHintLoading}
            onHint={handleHint}
            onNewGame={() => { if (isBotGame) resetBotGame(); else router.push('/app/lobby') }}
            onQuit={() => {
              if (!isBotGame && contractActive && !gameOver) handleResign()
              router.push('/app/lobby')
            }}
            quitForfeits={!isBotGame && contractActive && !gameOver}
          />
        </main>
      )}

      <GameResultOverlay
        gameResult={gameResult}
        resultMessage={resultMessage}
        gameData={gameData}
        wagerFormatted={wagerFormatted}
        payoutSettled={payoutSettled}
        onBackToLobby={() => router.push('/app/lobby')}
      />

      <PromotionModal
        open={!!pendingPromotion}
        color={pendingPromotion?.color ?? 'white'}
        onSelect={handlePromotionSelect}
        onCancel={() => setPendingPromotion(null)}
      />
    </div>
  )
}
