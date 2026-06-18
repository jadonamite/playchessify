// Shared types + constants for the game view.
export interface GameData {
  white: string
  black: string
  wager: string
  status: string
  // '0'=WAITING '1'=ACTIVE '2'=FINISHED '3'=CANCELLED '4'=DRAW
  drawProposer: string
}
export type GameResult = 'won' | 'lost' | 'draw' | null
export const ZERO = '0x0000000000000000000000000000000000000000'
export const BOT_SAVE_KEY = 'chess-bot-save'
export const TURN_TIMEOUT_SECS = 300
export const STATUS_LABELS: Record<string, string> = {
  '0': 'WAITING',
  '1': 'ACTIVE',
  '2': 'FINISHED',
  '3': 'CANCELLED',
  '4': 'DRAW',
}
export const normalizeString = (input: string | null | undefined): string => input?.toLowerCase() ?? ''
