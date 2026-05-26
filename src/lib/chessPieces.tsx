import type { PieceRenderObject } from 'react-chessboard'

// Active piece art. Assets live in `public/pieces/<set>/`.
// Swap this constant to change the in-game piece set.
export const PIECE_SET = 'caliente'

const CODES = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK'] as const

export const customPieces: PieceRenderObject = Object.fromEntries(
  CODES.map((code) => [
    code,
    () => (
      <img
        src={`/pieces/${PIECE_SET}/${code}.svg`}
        alt={code}
        draggable={false}
        style={{ width: '100%', height: '100%', userSelect: 'none', pointerEvents: 'none' }}
      />
    ),
  ]),
) as PieceRenderObject
