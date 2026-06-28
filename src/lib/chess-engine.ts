import { Chess, Move } from 'chess.js'

// Standard human-facing piece values for material tracking (pawn = 1).
const MATERIAL_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9
}

export interface CaptureSummary {
  // Piece types each side has captured (i.e. removed from the opponent),
  // ordered highest value first.
  whiteCaptured: string[]
  blackCaptured: string[]
  // Net material on the board. Positive = White ahead, negative = Black ahead.
  advantage: number
}

const START_COUNTS: Record<string, number> = {
  p: 8,
  n: 2,
  b: 2,
  r: 2,
  q: 1
}
const DISPLAY_ORDER = ['q', 'r', 'b', 'n', 'p'] as const

// Derive captured pieces and material balance from the current board position.
// Working from the board (not move history) keeps this correct even when the
// game is rebuilt from a FEN — which drops chess.js move history — and naturally
// accounts for promotions in the material count.
export function getCaptureSummary(board: ReturnType<Chess['board']>): CaptureSummary {
  const remaining = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 } as Record<string, number>,
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 } as Record<string, number>,
  }
  let whiteMaterial = 0
  let blackMaterial = 0
  for (const row of board) {
    for (const sq of row) {
      if (!sq || sq.type === 'k') continue
      remaining[sq.color][sq.type] = (remaining[sq.color][sq.type] ?? 0) + 1
      const value = MATERIAL_VALUES[sq.type] ?? 0
      if (sq.color === 'w') whiteMaterial += value
      else blackMaterial += value
    }
  }
  const capturedPieces = calculateCapturedPieces(remaining)
  return {
    whiteCaptured: capturedPieces.white,
    blackCaptured: capturedPieces.black,
    advantage: whiteMaterial - blackMaterial
  }
}

function calculateCapturedPieces(remaining: {
  w: Record<string, number>
  b: Record<string, number>
}): { white: string[], black: string[] } {
  const whiteCaptured: string[] = []
  const blackCaptured: string[] = []
  for (const t of DISPLAY_ORDER) {
    const blackMissing = Math.max(0, START_COUNTS[t] - remaining.b[t])
    const whiteMissing = Math.max(0, START_COUNTS[t] - remaining.w[t])
    for (let i = 0; i < blackMissing; i++) whiteCaptured.push(t)
    for (let i = 0; i < whiteMissing; i++) blackCaptured.push(t)
  }
  return { white: whiteCaptured, black: blackCaptured }
}

// ... rest of the code remains the same ...
