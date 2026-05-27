import type { PieceRenderObject } from 'react-chessboard'
import type { PieceSet } from '@/hooks/useSettingsStore'

const CODES = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK'] as const

// Path to a single piece SVG. Assets live in `public/pieces/<set>/`.
export function piecePath(set: PieceSet, code: string): string {
  return `/pieces/${set}/${code}.svg`
}

const cache: Partial<Record<PieceSet, PieceRenderObject>> = {}

// Build the react-chessboard piece renderer for a given set (memoized per set).
export function buildPieces(set: PieceSet): PieceRenderObject {
  const cached = cache[set]
  if (cached) return cached

  const pieces = Object.fromEntries(
    CODES.map((code) => [
      code,
      () => (
        <img
          src={piecePath(set, code)}
          alt={code}
          draggable={false}
          style={{ width: '100%', height: '100%', userSelect: 'none', pointerEvents: 'none' }}
        />
      ),
    ]),
  ) as PieceRenderObject

  cache[set] = pieces
  return pieces
}
