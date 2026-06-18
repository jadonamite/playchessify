import React from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Chess, type Square } from 'chess.js';
import ClayCard from '@/components/ui/ClayCard';
import { BOARD_THEMES, type PieceSet } from '@/hooks/useSettingsStore';
import CapturedTray from './CapturedTray';

const Chessboard = dynamic(() => import('react-chessboard').then(m => m.Chessboard), { ssr: false });

interface BoardPanelProps {
  game: Chess;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- react-chessboard custom pieces map
  customPieces: any;
  myColor: 'white' | 'black' | null;
  canAct: boolean;
  gameOver: boolean;
  isBotGame: boolean;
  turn: 'w' | 'b';
  isMyTurn: boolean;
  moveFrom: string;
  hintMove: { from: string; to: string } | null;
  showMoveHints: boolean;
  boardTheme: keyof typeof BOARD_THEMES;
  pieceSet: PieceSet;
  iAmWhite: boolean;
  myCaptured: string[];
  oppCaptured: string[];
  myAdvantage: number;
  soundOn: boolean;
  setSoundOn: (v: boolean) => void;
  handleCanDragPiece: (args: { isSparePiece: boolean; piece: unknown; square: string | null }) => boolean;
  handlePieceDrop: (args: { piece: unknown; sourceSquare: string; targetSquare: string | null }) => boolean;
  handleSquareClick: (args: { piece: unknown; square: string }) => void;
}

const getSquareStyles = (
  game: Chess,
  moveFrom: string,
  hintMove: { from: string; to: string } | null,
  showMoveHints: boolean
) => {
  const styles: Record<string, React.CSSProperties> = {};
  if (moveFrom) {
    styles[moveFrom] = { backgroundColor: 'rgba(0,204,255,0.35)' };
    if (showMoveHints) {
      const legalMoves = game.moves({ square: moveFrom as Square, verbose: true }) as Array<{ to: string; flags: string }>;
      legalMoves.forEach(({ to, flags }) => {
        const isCapture = flags.includes('c') || flags.includes('e');
        styles[to] = isCapture ? { boxShadow: 'inset 0 0 0 3px rgba(74,222,128,0.7)', borderRadius: '4px' } : { background: 'radial-gradient(circle, rgba(74,222,128,0.7) 30%, transparent 32%)' };
      });
    }
  }
  if (hintMove) {
    styles[hintMove.from] = { backgroundColor: 'rgba(251,191,36,0.35)' };
    styles[hintMove.to] = { background: 'radial-gradient(circle, rgba(251,191,36,0.65) 30%, transparent 32%)' };
  }
  return styles;
};

export default function BoardPanel(props: BoardPanelProps) {
  const {
    game,
    customPieces,
    myColor,
    canAct,
    gameOver,
    isBotGame,
    turn,
    isMyTurn,
    moveFrom,
    hintMove,
    showMoveHints,
    boardTheme,
    pieceSet,
    iAmWhite,
    myCaptured,
    oppCaptured,
    myAdvantage,
    soundOn,
    setSoundOn,
    handleCanDragPiece,
    handlePieceDrop,
    handleSquareClick,
  } = props;

  return (
    <ClayCard padding="none" className="pc-board-card p-0 md:p-8">
      <div className="absolute -right-10 -bottom-10 opacity-[0.025] rotate-12 pointer-events-none">
        <svg width="300" height="300" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19,22H5V20H19V22M17,10C17,8.9 16.1,8 15,8V7C15,5.34 13.66,4 12,4C10.34,4 9,5.34 9,7V8C7.9,8 7,8.9 7,10V11H17V10M15,13H9V18H15V13Z" />
        </svg>
      </div>
      {/* Board+trays group sized to the smaller of available width and viewport height so the board grows to fill yet always stays square (aspect-square). */}
      <div className="pc-board-wrap">
        {/* Opponent's captures (pieces they've taken from you) */}
        <div className="mb-1.5 md:mb-2 px-1">
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
              squareStyles: getSquareStyles(game, moveFrom, hintMove, showMoveHints),
              boardStyle: { borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' },
            }}
          />
        </div>
        {/* Your captures (pieces you've taken) */}
        <div className="mt-1.5 md:mt-2 px-1">
          <CapturedTray pieces={myCaptured} color={iAmWhite ? 'b' : 'w'} advantage={myAdvantage} set={pieceSet} />
        </div>
      </div>
      {/* Turn bar */}
      <div className="mt-3 md:mt-6 text-center px-3 md:px-0">
        {gameOver ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-[var(--c)]/10 border border-[var(--c)]/30"
          >
            <span className="text-[var(--c)] font-black uppercase tracking-widest text-sm">
              {game.isCheckmate() ? 'Checkmate' : game.isStalemate() ? 'Stalemate' : 'Game Over'}
            </span>
          </motion.div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <div
              className={`w-3 h-3 rounded-full transition-colors duration-300 $
                {turn === 'w' ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]' : 'bg-slate-600'
              }`
            }
            />
            <span className="text-sm font-bold tracking-widest text-[var(--t3)] uppercase">
              {isBotGame ? (turn === 'w' ? 'Your turn' : 'Bot thinking…') : isMyTurn ? 'Your turn' : 