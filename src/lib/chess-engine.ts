import { Chess, Move } from 'chess.js'
import type { CoachEngine, StyleWeights } from '@/config/coaches'

// Standard human-facing piece values for material tracking (pawn = 1).
const MATERIAL_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 }

export interface CaptureSummary {
  // Piece types each side has captured (i.e. removed from the opponent),
  // ordered highest value first.
  whiteCaptured: string[]
  blackCaptured: string[]
  // Net material on the board. Positive = White ahead, negative = Black ahead.
  advantage: number
}

const START_COUNTS: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 }
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

  const whiteCaptured: string[] = [] // black pieces White has removed
  const blackCaptured: string[] = [] // white pieces Black has removed
  for (const t of DISPLAY_ORDER) {
    const blackMissing = Math.max(0, START_COUNTS[t] - remaining.b[t])
    const whiteMissing = Math.max(0, START_COUNTS[t] - remaining.w[t])
    for (let i = 0; i < blackMissing; i++) whiteCaptured.push(t)
    for (let i = 0; i < whiteMissing; i++) blackCaptured.push(t)
  }

  return { whiteCaptured, blackCaptured, advantage: whiteMaterial - blackMaterial }
}

// Piece values for material evaluation (centipawn-style, scaled by 10).
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
}

// Piece-square tables — White's perspective. Row 0 = rank 8 (Black's back rank).
// Mirrored at lookup time for Black. Higher = better square for that piece.

const PAWN_TABLE = [
  [ 0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [ 5,  5, 10, 25, 25, 10,  5,  5],
  [ 0,  0,  0, 20, 20,  0,  0,  0],
  [ 5, -5,-10,  0,  0,-10, -5,  5],
  [ 5, 10, 10,-20,-20, 10, 10,  5],
  [ 0,  0,  0,  0,  0,  0,  0,  0],
]

const KNIGHT_TABLE = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50],
]

const BISHOP_TABLE = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20],
]

const ROOK_TABLE = [
  [ 0,  0,  0,  0,  0,  0,  0,  0],
  [ 5, 10, 10, 10, 10, 10, 10,  5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [ 0,  0,  0,  5,  5,  0,  0,  0],
]

const QUEEN_TABLE = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [ -5,  0,  5,  5,  5,  5,  0, -5],
  [  0,  0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  0,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20],
]

// Middlegame king table — keep the king tucked behind pawns and away from the center.
const KING_TABLE = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [ 20, 20,  0,  0,  0,  0, 20, 20],
  [ 20, 30, 10,  0,  0, 10, 30, 20],
]

const TABLES: Record<string, number[][]> = {
  p: PAWN_TABLE,
  n: KNIGHT_TABLE,
  b: BISHOP_TABLE,
  r: ROOK_TABLE,
  q: QUEEN_TABLE,
  k: KING_TABLE,
}

function squareValue(type: string, color: 'w' | 'b', row: number, col: number): number {
  const table = TABLES[type]
  if (!table) return 0
  // White uses the table as-is (row 0 is Black's back rank). For Black, mirror vertically.
  return color === 'w' ? table[row][col] : table[7 - row][col]
}

function evaluateBoard(game: Chess): number {
  // Terminal-state shortcuts — checkmate is decisive, stalemate / draw is neutral.
  if (game.isCheckmate()) return game.turn() === 'w' ? -Infinity : Infinity
  if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition()) return 0

  let totalEvaluation = 0
  const board = game.board()

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col]
      if (!piece) continue
      const value = (PIECE_VALUES[piece.type] || 0) + squareValue(piece.type, piece.color, row, col)
      totalEvaluation += piece.color === 'w' ? value : -value
    }
  }
  return totalEvaluation
}

// MVV-LVA-style move ordering — captures of high-value victims by low-value
// attackers come first, then other captures, promotions, checks, then quiet
// moves. Better ordering = better alpha-beta pruning = a stronger bot at the
// same depth.
function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => scoreMove(b) - scoreMove(a))
}

function scoreMove(m: Move): number {
  let score = 0
  if (m.captured) {
    score += 10 * (PIECE_VALUES[m.captured] || 0) - (PIECE_VALUES[m.piece] || 0)
  }
  if (m.promotion) score += PIECE_VALUES[m.promotion] || 0
  if (m.flags.includes('e')) score += 100 // en passant
  if (m.san.includes('+')) score += 50    // gives check
  if (m.san.includes('#')) score += 10000 // delivers mate
  return score
}

export function getBestMove(game: Chess, depth: number = 3): Move | null {
  const possibleMoves = orderMoves(game.moves({ verbose: true }))
  if (game.isGameOver() || possibleMoves.length === 0) return null

  // The bot always plays Black (enforced by GameClient): Black minimizes.
  let bestMove: Move | null = null
  let bestValue = Infinity

  for (const move of possibleMoves) {
    game.move(move)
    const boardValue = minimax(game, depth - 1, -Infinity, Infinity, true)
    game.undo()

    if (boardValue < bestValue) {
      bestValue = boardValue
      bestMove = move
    }
  }

  return bestMove
}

export function getHintMove(game: Chess, depth = 3): Move | null {
  const moves = orderMoves(game.moves({ verbose: true }))
  if (game.isGameOver() || moves.length === 0) return null

  const isWhite = game.turn() === 'w'
  let best: Move | null = null
  let bestVal = isWhite ? -Infinity : Infinity

  for (const move of moves) {
    game.move(move)
    const val = minimax(game, depth - 1, -Infinity, Infinity, !isWhite)
    game.undo()
    if (isWhite ? val > bestVal : val < bestVal) {
      bestVal = val
      best = move
    }
  }
  return best
}

/* ── coach move (style-biased, ELO-scaled) ───────────────────────────────────
 * The coach's OWN move in teacher/opponent mode. Unlike getBestMove this is
 * deliberately imperfect and flavoured: it scores root moves with minimax,
 * adds a personality bonus, takes the top-K, then softmax-samples by
 * temperature — so a high-ELO coach (topK=1, temp=0) is near-best while a
 * lower one occasionally plays an inferior move (felt weakness). Side-agnostic:
 * the coach is whichever side is to move. */

function fileRank(square: string): [number, number] {
  return [square.charCodeAt(0) - 97, Number(square[1]) - 1] // file 0-7, rank 0-7
}

function enemyKingSquare(game: Chess, coachColor: 'w' | 'b'): [number, number] | null {
  const enemy = coachColor === 'w' ? 'b' : 'w'
  const board = game.board() // board[0] = rank 8
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p?.type === 'k' && p.color === enemy) return [c, 7 - r]
    }
  }
  return null
}

function styleBonus(move: Move, game: Chess, coachColor: 'w' | 'b', s: StyleWeights, ahead: boolean): number {
  let b = 0
  // forcing — checks and captures keep the initiative
  if (move.san.includes('#')) b += s.forcing * 60
  else if (move.san.includes('+')) b += s.forcing * 45
  if (move.captured) b += s.forcing * 18
  // sacrifice — trading a higher piece for a lower one / speculative captures
  if (move.captured && (PIECE_VALUES[move.piece] || 0) > (PIECE_VALUES[move.captured] || 0)) b += s.sacrifice * 14
  // king attack — landing near the enemy king
  const ek = enemyKingSquare(game, coachColor)
  if (ek) {
    const [tf, tr] = fileRank(move.to)
    const d = Math.max(Math.abs(tf - ek[0]), Math.abs(tr - ek[1]))
    if (d <= 2) b += s.kingAttack * (3 - d) * 18
  }
  // simplify — trade down when ahead (endgame grind)
  if (move.captured && ahead) b += s.simplify * 20
  // positional — gravitate to the centre
  const [tf, tr] = fileRank(move.to)
  const central = 3.5 - Math.max(Math.abs(tf - 3.5), Math.abs(tr - 3.5))
  b += s.positional * central * 6
  return b
}

export function getCoachMove(game: Chess, engine: CoachEngine): Move | null {
  const moves = orderMoves(game.moves({ verbose: true }))
  if (game.isGameOver() || moves.length === 0) return null

  const coachColor = game.turn() as 'w' | 'b'
  const evalNow = evaluateBoard(game) // White-positive
  const ahead = coachColor === 'w' ? evalNow > 150 : evalNow < -150

  const scored = moves.map((m) => {
    game.move(m)
    // After the coach moves it's the opponent's turn: White maximizes the
    // White-positive eval, Black minimizes → isMax = (coach is Black).
    const val = minimax(game, engine.depth - 1, -Infinity, Infinity, coachColor === 'b')
    game.undo()
    const coachVal = coachColor === 'w' ? val : -val // convert to "higher = better for coach"
    return { m, score: coachVal + styleBonus(m, game, coachColor, engine.style, ahead) }
  })

  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, Math.max(1, engine.topK))
  if (engine.temperature <= 0 || top.length === 1) return top[0].m

  // Softmax sample among the top-K (temperature scaled from cp to a usable range).
  const T = engine.temperature * 200
  const max = top[0].score
  const weights = top.map((t) => Math.exp((t.score - max) / T))
  const sum = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * sum
  for (let i = 0; i < top.length; i++) {
    r -= weights[i]
    if (r <= 0) return top[i].m
  }
  return top[0].m
}

function minimax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizingPlayer: boolean
): number {
  if (depth === 0 || game.isGameOver()) return evaluateBoard(game)

  const possibleMoves = orderMoves(game.moves({ verbose: true }))

  if (isMaximizingPlayer) {
    let bestValue = -Infinity
    for (const move of possibleMoves) {
      game.move(move)
      bestValue = Math.max(bestValue, minimax(game, depth - 1, alpha, beta, false))
      game.undo()
      alpha = Math.max(alpha, bestValue)
      if (beta <= alpha) break
    }
    return bestValue
  } else {
    let bestValue = Infinity
    for (const move of possibleMoves) {
      game.move(move)
      bestValue = Math.min(bestValue, minimax(game, depth - 1, alpha, beta, true))
      game.undo()
      beta = Math.min(beta, bestValue)
      if (beta <= alpha) break
    }
    return bestValue
  }
}
