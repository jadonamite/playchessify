'use client'

import React, { useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Chess, type Square } from 'chess.js'
import { buildPieces } from '@/lib/chessPieces'
import { BOARD_THEMES, useSettingsStore } from '@/hooks/useSettingsStore'

const Chessboard = dynamic(() => import('react-chessboard').then((m) => m.Chessboard), { ssr: false })

interface TrainingBoardProps {
  game: Chess
  orientation?: 'white' | 'black'
  /** Whose move the human may make; if false the board is read-only. */
  interactive: boolean
  /**
   * Attempt a move. Return true if accepted (board advances), false to reject
   * (snaps back). The PARENT owns game state — this only reports intent.
   */
  onMove: (from: string, to: string) => boolean
  /** Extra square highlights (e.g. a hint or the square of a flagged blunder). */
  highlights?: Record<string, React.CSSProperties>
  showLegalDots?: boolean
}

/**
 * Lean self-contained board for the training flows. Reuses the app's piece sets
 * and board themes but stays decoupled from the live GameClient so teacher-mode
 * work never touches the wagered-game paths.
 */
export default function TrainingBoard({
  game, orientation = 'white', interactive, onMove, highlights = {}, showLegalDots = true,
}: TrainingBoardProps) {
  const { boardTheme, pieceSet } = useSettingsStore()
  const customPieces = useMemo(() => buildPieces(pieceSet), [pieceSet])
  const [moveFrom, setMoveFrom] = useState('')

  const legalStyles = (from: string): Record<string, React.CSSProperties> => {
    const styles: Record<string, React.CSSProperties> = {
      [from]: { backgroundColor: 'rgba(0,204,255,0.35)' },
    }
    if (showLegalDots) {
      const legal = game.moves({ square: from as Square, verbose: true }) as Array<{ to: string; flags: string }>
      legal.forEach(({ to, flags }) => {
        const isCapture = flags.includes('c') || flags.includes('e')
        styles[to] = isCapture
          ? { boxShadow: 'inset 0 0 0 3px rgba(74,222,128,0.7)', borderRadius: '4px' }
          : { background: 'radial-gradient(circle, rgba(74,222,128,0.7) 30%, transparent 32%)' }
      })
    }
    return styles
  }

  const tryMove = (from: string, to: string): boolean => {
    const ok = onMove(from, to)
    setMoveFrom('')
    return ok
  }

  // Unified tap handler. react-chessboard v5 fires onSquareClick only for empty
  // squares; taps on a piece (select / capture) fire onPieceClick. Wire both so
  // click-to-move never gets "stuck" on a piece. Dedup the desktop echo where a
  // piece tap bubbles and fires both.
  const lastTapRef = useRef<{ square: string; at: number } | null>(null)
  const handleTap = (square: string) => {
    if (!interactive) return
    const now = Date.now()
    const last = lastTapRef.current
    if (last?.square === square && now - last.at < 250) return
    lastTapRef.current = { square, at: now }

    if (!moveFrom) {
      const piece = game.get(square as Square)
      if (piece?.color === game.turn()) setMoveFrom(square)
      return
    }
    if (square === moveFrom) { setMoveFrom(''); return }
    if (!tryMove(moveFrom, square)) {
      const piece = game.get(square as Square)
      if (piece?.color === game.turn()) setMoveFrom(square)
    }
  }

  return (
    <div className="aspect-square w-full">
      <Chessboard
        options={{
          id: 'training-board',
          position: game.fen(),
          pieces: customPieces,
          boardOrientation: orientation,
          allowDragging: interactive,
          onPieceDrop: ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) =>
            targetSquare ? tryMove(sourceSquare, targetSquare) : false,
          onSquareClick: ({ square }: { square: string }) => handleTap(square),
          onPieceClick: ({ square }: { square: string | null }) => { if (square) handleTap(square) },
          darkSquareStyle: { backgroundColor: BOARD_THEMES[boardTheme].dark },
          lightSquareStyle: { backgroundColor: BOARD_THEMES[boardTheme].light },
          squareStyles: { ...(moveFrom ? legalStyles(moveFrom) : {}), ...highlights },
          boardStyle: { borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' },
        }}
      />
    </div>
  )
}
