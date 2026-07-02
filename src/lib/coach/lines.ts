import type { Move, Chess } from 'chess.js'
import type { Specialty } from '@/config/coaches'

/**
 * Instant, local coach lines — no engine, no network. These make the coach
 * react to YOU (your move) the moment you play, which is what makes it feel
 * like coaching rather than just an opponent. The deep blunder check + LLM
 * enrichment layer on top of this asynchronously.
 */

const PIECE_NAME: Record<string, string> = {
  p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king',
}

/** Opening trash-talk when you Challenge a coach to a full match. */
const TAUNTS: Record<string, string> = {
  kasparov: "Let's get it started, hotshot. I don't take prisoners.",
  fischer: 'Chess is a fight. Don\'t waste my time — show me something.',
  carlsen: 'Alright. Let\'s play a real game. No mercy from me.',
  karpov: "I'll give you nothing. Try to take it from me.",
  polgar: 'Outrageous — you think you can beat me? Bring it on.',
  houyifan: 'A clean, sharp game then. Let\'s see what you\'ve got.',
  harmon: 'Make it interesting. I dare you to keep up.',
}

export function taunt(coachId: string): string {
  return TAUNTS[coachId] ?? 'Let\'s play. Show me what you can do.'
}

// Praise lines flavoured a little by the coach's specialty.
const PRAISE: Record<Specialty, string[]> = {
  attack: ['Yes — keep the pressure on.', 'Good, that\'s aggressive. I like it.'],
  tactics: ['Sharp. You\'re seeing the board.', 'Good eye — that\'s the idea.'],
  positional: ['Solid. Small edges add up.', 'Patient and sound. Good.'],
  endgame: ['Clean. That\'s good technique.', 'Precise — keep it simple.'],
  universal: ['Well played. That holds up.', 'Good, balanced choice.'],
}

const TIPS = [
  'Now — what is your opponent threatening?',
  'Think about your worst-placed piece. Improve it.',
  'Keep developing; get everyone in the game.',
  'Mind your king\'s safety.',
  'Fight for the centre.',
]

/**
 * A short coaching note about the move YOU just made. Derived purely from the
 * move + resulting position, so it's instant.
 */
export function coachingComment(move: Move, after: Chess, moveNumber: number, specialty: Specialty): string {
  if (after.isCheckmate()) return 'Checkmate — that\'s the game! Beautifully done.'
  if (move.san.includes('#')) return 'Checkmate! Outstanding.'
  if (move.promotion) return 'A new queen — that should be decisive.'
  if (move.san.includes('+')) return 'Check! Make them deal with it.'
  if (move.flags.includes('k') || move.flags.includes('q')) return 'Castled — good, your king is tucked away safely.'
  if (move.captured) return `You take the ${PIECE_NAME[move.captured] ?? 'piece'}. Keep counting material.`
  // Development in the opening.
  if (moveNumber <= 12 && (move.piece === 'n' || move.piece === 'b') && /[18]/.test(move.from[1])) {
    return PRAISE[specialty][0]
  }
  // Central pawn push.
  if (move.piece === 'p' && (move.to === 'e4' || move.to === 'd4' || move.to === 'e5' || move.to === 'd5')) {
    return 'Claiming the centre — principled chess.'
  }
  // Otherwise a rotating tip / light praise.
  if (moveNumber % 3 === 0) return PRAISE[specialty][moveNumber % PRAISE[specialty].length]
  return TIPS[moveNumber % TIPS.length]
}

/** A brief banter line the coach drops in a full match (occasional). */
const BANTER = [
  'Is that all?', 'Interesting. Let\'s see where this goes.', 'I\'m still in control.',
  'Careful now.', 'You\'re fighting — I\'ll give you that.',
]
export function banter(moveNumber: number): string {
  return BANTER[moveNumber % BANTER.length]
}
