'use client'
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Chess, type Square, type Move } from 'chess.js'
import { AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useWallet } from '@/components/wallet-provider'
import { useCeloChess } from '@/hooks/useCeloChess'
import GlowButton from '@/components/ui/GlowButton'
import LoadingState from '@/components/ui/LoadingState'
import PromotionModal, { PromotionPiece } from '@/components/ui/PromotionModal'
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
import MatchIntro from './MatchIntro'
import JoinRoom from './JoinRoom'
import { BOT_SAVE_KEY, TURN_TIMEOUT_SECS, type GameResult } from './types'

const deriveGameResult = (
  isBotGame: boolean,
  isParticipant: boolean,
  myColor: string | null,
  iProposedDraw: boolean,
  opponentProposedDraw: boolean,
  gameIsWaiting: boolean,
  contractActive: boolean,
  contractDone: boolean,
  contractDraw: boolean,
  payoutSettled: boolean,
  canJoinFromPage: boolean,
  wagerFormatted: string,
  statusLabel: string,
  gameProfileMap: any,
  didResign: boolean,
  opponentTimedOut: boolean,
  game: Chess,
): GameResult | null => {
  if (isBotGame) return null
  if (isParticipant) {
    if (game.isCheckmate()) {
      const loserSide = game.turn()
      if (loserSide === 'w' && myColor === 'black') return 'won'
      if (loserSide === 'b' && myColor === 'white') return 'won'
      if (loserSide === 'w' && myColor === 'white') return 'lost'
      if (loserSide === 'b' && myColor === 'black') return 'lost'
    }
    if (didResign) return 'lost'
    if (game.isDraw() || game.isStalemate() || contractDraw) return 'draw'
    if (opponentTimedOut) return 'won'
    if (contractDone && !didResign) return 'won'
  }
  return null
}

const deriveResultMessage = (
  gameResult: GameResult | null,
  opponentTimedOut: boolean,
  game: Chess,
): string => {
  if (gameResult === 'won') {
    if (opponentTimedOut) return 'Opponent exceeded the 5-minute turn limit.'
    if (game.isCheckmate()) return 'Checkmate — the King has fallen.'
    return 'Opponent forfeited the match.'
  }
  if (gameResult === 'lost') {
    if (game.isCheckmate()) return 'Your King has fallen.'
    return 'You resigned from the match.'
  }
  return 'Tactical deadlock — neither side can proceed.'
}

export default function GameClient() {
  // ... (rest of the code remains the same)
  const gameResult = deriveGameResult(
    isBotGame,
    isParticipant,
    myColor,
    iProposedDraw,
    opponentProposedDraw,
    gameIsWaiting,
    contractActive,
    contractDone,
    contractDraw,
    payoutSettled,
    canJoinFromPage,
    wagerFormatted,
    statusLabel,
    gameProfileMap,
    didResign,
    opponentTimedOut,
    game
  )
  const resultMessage = deriveResultMessage(
    gameResult,
    opponentTimedOut,
    game
  )
  // ... (rest of the code remains the same)
}