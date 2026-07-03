export interface GameData {
  white: string
  black: string
  wager: string
  status: string // '0'=WAITING '1'=ACTIVE '2'=FINISHED '3'=CANCELLED '4'=DRAW
  result: string // '0'=None '1'=WhiteWins '2'=BlackWins '3'=DrawResult '4'=Cancelled
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

const getResultBasedOnColor = (result: string, myColor: 'white' | 'black'): GameResult => {
  if (result === '1') return myColor === 'white' ? 'won' : 'lost'
  if (result === '2') return myColor === 'black' ? 'won' : 'lost'
  if (result === '3') return 'draw'
  return null
}

export function resultForColor(
  result: string | undefined,
  myColor: 'white' | 'black' | null,
): GameResult {
  if (!myColor) return null
  return getResultBasedOnColor(result ?? '', myColor)
}
