import { Chess } from 'chess.js'
import type { MoveRecord } from '@/lib/moves-store'

// Shared, client-safe settlement helpers. Imported by BOTH the browser (to sign
// moves) and the server (to verify + replay). Keep this file free of any
// server-only imports (no private keys, no node-only deps).

// Contract GameResult enum values (mirror ChessGame.GameResult).
export const RESULT = {
  WhiteWins: 1,
  BlackWins: 2,
  Draw: 3,
} as const
export type ResultValue = (typeof RESULT)[keyof typeof RESULT]

// A side that hasn't moved within this window after the opponent's last move
// forfeits on time. Mirrors the in-game 5-minute move clock.
export const MOVE_TIMEOUT_MS = 5 * 60 * 1000

/**
 * The exact message a player signs to authenticate a move. Deterministic and
 * identical on client (signing) and server (verification): it binds the move to
 * this game, this ply, this SAN, and the resulting position, so a signature for
 * one move can never be replayed onto another.
 */
export function canonicalMoveMessage(p: { chain: string; gameId: number; moveNumber: number; san: string; fen: string }): string {
  return [
    'playchessify:move',
    `chain:${p.chain}`,
    `game:${p.gameId}`,
    `n:${p.moveNumber}`,
    `san:${p.san}`,
    `fen:${p.fen}`,
  ].join('\n')
}

export type Terminal =
  | { kind: 'result'; result: ResultValue }
  | { kind: 'not-terminal' }
  | { kind: 'illegal' }

function getGameResult(chess: Chess): ResultValue | null {
  if (chess.isCheckmate()) {
    const loserIsWhite = chess.turn() === 'w'
    return loserIsWhite ? RESULT.BlackWins : RESULT.WhiteWins
  }
  if (chess.isStalemate() || chess.isInsufficientMaterial() || chess.isDraw()) {
    return RESULT.Draw
  }
  return null
}

/**
 * Replay the authoritative move list and decide the result. NEVER trusts the
 * client — the SAN list is replayed move-by-move with chess.js, and an illegal
 * sequence is rejected.
 */
export function deriveResult(moves: MoveRecord[], white: string, black: string): Terminal {
  const chess = new Chess()
  for (const m of moves) {
    try {
      const applied = chess.move(m.san)
      if (!applied) return { kind: 'illegal' }
    } catch {
      return { kind: 'illegal' }
    }
  }
  const result = getGameResult(chess)
  if (result !== null) {
    return { kind: 'result', result }
  }
  // Not terminal by board — check the move clock for a timeout forfeit.
  if (moves.length > 0) {
    const last = moves[moves.length - 1]
    if (Date.now() - last.ts > MOVE_TIMEOUT_MS) {
      // Side to move has run out of time → the player who made the last move wins.
      const winnerIsWhite = chess.turn() !== 'w'
      const winnerAddr = winnerIsWhite ? white : black
      if (last.player.toLowerCase() === winnerAddr.toLowerCase()) {
        return {
          kind: 'result',
          result: winnerIsWhite ? RESULT.WhiteWins : RESULT.BlackWins,
        }
      }
    }
  }
  return { kind: 'not-terminal' }
}

/**
 * Whose turn is it after replaying `moves`, expressed as the player address.
 * Returns null if the sequence is illegal. Used by the relay to enforce that a
 * submitted move actually comes from the side to move.
 */
export function sideToMoveAddress(moves: MoveRecord[], white: string, black: string): string | null {
  const chess = new Chess()
  for (const m of moves) {
    try {
      if (!chess.move(m.san)) return null
    } catch {
      return null
    }
  }
  return chess.turn() === 'w' ? white : black
}
