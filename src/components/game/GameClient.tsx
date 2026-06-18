import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Chess, type Square, type Move } from 'chess.js';
import { AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useWallet } from '@/components/wallet-provider';
import { useCeloChess } from '@/hooks/useCeloChess';
import GlowButton from '@/components/ui/GlowButton';
import LoadingState from '@/components/ui/LoadingState';
import PromotionModal, { PromotionPiece } from '@/components/ui/PromotionModal';
import { getBestMove, getHintMove, getCaptureSummary } from '@/lib/chess-engine';
import { playMoveChime } from '@/lib/audio';
import { useGameMoves } from '@/hooks/useGameMoves';
import { useToastStore } from '@/hooks/useToastStore';
import { useSettingsStore, AI_DEPTH } from '@/hooks/useSettingsStore';
import { buildPieces } from '@/lib/chessPieces';
import { useGameData } from '@/hooks/useGameData';
import AmbientBackground from './AmbientBackground';
import GameHeader from './GameHeader';
import BoardPanel from './BoardPanel';
import GameSidebar from './GameSidebar';
import GameActionBar from './GameActionBar';
import GameResultOverlay from './GameResultOverlay';
import MatchIntro from './MatchIntro';
import WaitingRoom from './WaitingRoom';
import JoinRoom from './JoinRoom';
import { BOT_SAVE_KEY, TURN_TIMEOUT_SECS, type GameResult } from './types';

const deriveGameResult = (
  isBotGame: boolean,
  isParticipant: boolean,
  myColor: string | null,
  game: Chess,
  didResign: boolean,
  opponentTimedOut: boolean,
  contractDone: boolean,
  contractDraw: boolean
) => {
  if (isBotGame) return null;
  if (isParticipant) {
    if (game.isCheckmate()) {
      const loserSide = game.turn();
      if (loserSide === 'w' && myColor === 'black') return 'won';
      if (loserSide === 'b' && myColor === 'white') return 'won';
      if (loserSide === 'w' && myColor === 'white') return 'lost';
      if (loserSide === 'b' && myColor === 'black') return 'lost';
    }
    if (didResign) return 'lost';
    if (game.isDraw() || game.isStalemate() || contractDraw) return 'draw';
    if (opponentTimedOut) return 'won';
    if (contractDone && !didResign) return 'won';
  }
  return null;
};

const GameClient = () => {
  // ...
  const gameResult = deriveGameResult(
    isBotGame,
    isParticipant,
    myColor,
    game,
    didResign,
    opponentTimedOut,
    contractDone,
    contractDraw
  );
  // ...
};
export default GameClient;
