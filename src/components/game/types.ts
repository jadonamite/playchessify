// Shared types + constants for the game view.
export interface GameData {
  white: string
  black: string
  wager: string
  status: GameStatus
  drawProposer: string
}
export type GameResult = 'won' | 'lost' | 'draw' | null
export type GameStatus = '0' | '1' | '2' | '3' | '4'
export const ZERO = '0x0000000000000000000000000000000000000000'
export const BOT_SAVE_KEY = 'chess-bot-save'
export const TURN_TIMEOUT_SECS = 300
export const STATUS_LABELS: Record<GameStatus, string> = {
  '0': 'WAITING',
  '1': 'ACTIVE',
  '2': 'FINISHED',
  '3': 'CANCELLED',
  '4': 'DRAW',
}
export const normalizeString = (input: string | null | undefined): string => {
  if (typeof input !== 'string') {
    throw new Error(`Expected a string, but got ${typeof input}`)
  }
  return input.toLowerCase()
}
