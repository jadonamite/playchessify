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
  game: Chess,
  myColor: string | null,
  didResign: boolean,
  opponentTimedOut: boolean,
  contractDone: boolean,
  contractDraw: boolean
): GameResult | null => {
  if (isBotGame) return null
  if (isParticipant) {
    if (game.isCheckmate()) {
      const loserSide = game.turn()
      if (
        (loserSide === 'w' && myColor === 'black') ||
        (loserSide === 'b' && myColor === 'white')
      )
        return 'won'
      else if (
        (loserSide === 'w' && myColor === 'white') ||
        (loserSide === 'b' && myColor === 'black')
      )
        return 'lost'
    } else if (didResign) return 'lost'
    else if (game.isDraw() || game.isStalemate() || contractDraw) return 'draw'
    else if (opponentTimedOut) return 'won'
    else if (contractDone && !didResign) return 'won'
  }
  return null
}

const deriveResultMessage = (
  gameResult: GameResult | null,
  opponentTimedOut: boolean,
  isCheckmate: boolean,
  myColor: string | null,
  game: Chess
): string => {
  if (gameResult === 'won')
    return opponentTimedOut
      ? 'Opponent exceeded the 5-minute turn limit.'
      : isCheckmate
      ? `Checkmate — the King has fallen.`
      : 'Opponent forfeited the match.'
  else if (gameResult === 'lost')
    return isCheckmate ? `Your King has fallen.` : 'You resigned from the match.'
  else return 'Tactical deadlock — neither side can proceed.'
}

export default function GameClient() {
  // ...
  const gameResult = deriveGameResult(
    isBotGame,
    isParticipant,
    game,
    myColor,
    didResign,
    opponentTimedOut,
    contractDone,
    contractDraw
  )
  const resultMessage = deriveResultMessage(
    gameResult,
    opponentTimedOut,
    game.isCheckmate(),
    myColor,
    game
  )
  // ...
}