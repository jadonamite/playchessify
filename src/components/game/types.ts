// Shared types + constants for the game view.

export interface GameData {
  white: string
  black: string
  wager: string
  status: string // '0'=WAITING '1'=ACTIVE '2'=FINISHED '3'=CANCELLED '4'=DRAW
  result: string // '0'=None '1'=WhiteWins '2'=BlackWins '3'=DrawResult '4'=Cancelled
  createdAt: string // unix seconds (v2 contracts store timestamps)
  drawProposer: string
}

export type GameResult = 'won' | 'lost' | 'draw' | null

export const ZERO = '0x0000000000000000000000000000000000000000'
export const BOT_SAVE_KEY = 'chess-bot-save'
export const TURN_TIMEOUT_SECS = 300

export const STATUS_LABELS: Record<string, string> = {
  '0': 'WAITING', '1': 'ACTIVE', '2': 'FINISHED', '3': 'CANCELLED', '4': 'DRAW',
}

export const norm = (a: string) => (a ?? '').toLowerCase()

// Map the authoritative on-chain result to the viewer's perspective. The single
// source of truth once a game is settled — so a returning player always sees the
// real outcome instead of a guess derived from the board / local flags.
export function resultForColor(
  result: string | undefined,
  myColor: 'white' | 'black' | null,
): GameResult {
  if (!myColor) return null
  if (result === '1') return myColor === 'white' ? 'won' : 'lost' // WhiteWins
  if (result === '2') return myColor === 'black' ? 'won' : 'lost' // BlackWins
  if (result === '3') return 'draw'                               // DrawResult
  return null
}
