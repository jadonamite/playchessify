import type { Move, Chess } from 'chess.js'
import type { Specialty } from '@/config/coaches'

const PIECE_NAME: Record<string, string> = {
  p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king',
}

/** Opening trash-talk when you Challenge a coach to a full match. */
const TAUNTS: Record<string, string> = {
  kasparov: "Let's get it started, hotshot. I don't take prisoners.\