import type { Move, Chess } from 'chess.js'
import { COACHES, type CoachProfile } from '@/config/coaches'

/**
 * Archetype reactions — the free half of the coach.
 *
 * Deterministic and local, because this fires on every move of every game.
 * The same move must read differently per coach; if two coaches' lines are
 * interchangeable, this file has failed. Half the lines end on a question,
 * to make the metered ask worth spending.
 */

/* Classified from the move and position only, never Stockfish — a reaction has
 * to land instantly. It is a personality, not a verdict; the verdict is the ask. */
export type Situation =
  | 'checkmate' | 'check' | 'promotion' | 'castle'
  | 'captureUp' | 'captureTrade' | 'captureDown'
  | 'development' | 'centerPawn' | 'queenEarly' | 'retreat' | 'quiet'

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

/** Which way is "backwards" for the side that just moved. */
function isRetreat(move: Move): boolean {
  if (move.piece === 'p') return false // pawns cannot retreat
  const fromRank = Number(move.from[1])
  const toRank = Number(move.to[1])
  return move.color === 'w' ? toRank < fromRank : toRank > fromRank
}

export function classify(move: Move, after: Chess, moveNumber: number): Situation {
  if (after.isCheckmate()) return 'checkmate'
  if (move.promotion) return 'promotion'
  if (move.flags.includes('k') || move.flags.includes('q')) return 'castle'
  if (after.inCheck()) return 'check'

  if (move.captured) {
    const took = VALUE[move.captured] ?? 0
    const risked = VALUE[move.piece] ?? 0
    if (took > risked) return 'captureUp'
    if (took === risked) return 'captureTrade'
    return 'captureDown'
  }

  if (move.piece === 'q' && moveNumber <= 6) return 'queenEarly'
  if (moveNumber <= 12 && (move.piece === 'n' || move.piece === 'b') && /[18]/.test(move.from[1])) {
    return 'development'
  }
  if (move.piece === 'p' && ['e4', 'd4', 'e5', 'd5'].includes(move.to)) return 'centerPawn'
  if (isRetreat(move)) return 'retreat'
  return 'quiet'
}

/* Two lines per situation per coach. Short on purpose — this renders on one
 * line above the board. */
type Bank = Record<Situation, [string, string]>

const KASPAROV: Bank = {
  checkmate: ['That is how it should end. No mercy.', 'Mate. You went for the throat and it worked.'],
  check: ['Good — make him answer you.', 'Check. Now keep him moving, do not let him breathe.'],
  promotion: ['A queen. Finish it now, do not get sentimental.', 'New queen. The game should be over in five.'],
  castle: ['Fine, king is safe. Now attack.', 'Castled. That was the last quiet move you are allowed.'],
  captureUp: ['You took material and you were right to.', 'Material. Good. Now convert it into an attack, not a draw.'],
  captureTrade: ['A trade. Did that help you or him?', 'Even exchange. I would rather you had kept the tension.'],
  captureDown: ['You gave up more than you took. Tell me the compensation.', 'That costs material. I hope you saw something I did not.'],
  development: ['Yes — pieces out, then we hunt.', 'Developing. Do not fall in love with it, the attack comes next.'],
  centerPawn: ['Take the centre. That is where games are won.', 'Good, claim it. Now who is going to stop you?'],
  queenEarly: ['Your queen is out early. She will be chased.', 'Too soon. He will develop with tempo on her.'],
  retreat: ['You retreated. Was that necessary or was that fear?', 'Backwards. I want to know what frightened you.'],
  quiet: ['A quiet move. What is it threatening?', 'You had a fight available and you shuffled.'],
}

const FISCHER: Bank = {
  checkmate: ['Mate. Correct.', 'That is the point of the game. Well done.'],
  check: ['Check. Only play it if it leads somewhere.', 'A check is not a plan. What follows it?'],
  promotion: ['A queen. Convert cleanly, no tricks.', 'Promoted. Now do not spoil it.'],
  castle: ['King safe. Correct order.', 'Castled. Good. That is basic and you did it.'],
  captureUp: ['You won material. Simplify and win the ending.', 'Material up. Trade pieces, not pawns.'],
  captureTrade: ['An even trade. Was it forced, or lazy?', 'Equal exchange. Neutral. I want better than neutral.'],
  captureDown: ['That is losing material. Explain it.', 'You gave up more than you took. Sloppy.'],
  development: ['Develop. Every piece, then castle.', 'Correct. Do not move it twice.'],
  centerPawn: ['The centre. Principled.', 'Good. Now hold it.'],
  queenEarly: ['Do not bring the queen out this early.', 'Premature. She will be a target for five moves.'],
  retreat: ['A retreat costs a tempo. Was it worth one?', 'Backwards. That had better be prophylaxis and not panic.'],
  quiet: ['A waiting move. I dislike waiting moves.', 'That does nothing. Find a move that does something.'],
}

const CARLSEN: Bank = {
  checkmate: ['Mate. Clean.', 'That is the game. Nicely done.'],
  check: ['Check. Useful if it improves your position too.', 'Fine. Does he have a comfortable square?'],
  promotion: ['New queen. Technique from here.', 'Promoted. Now just be accurate, nothing fancy.'],
  castle: ['Sensible. King tucked away.', 'Castled. Now improve your worst piece.'],
  captureUp: ['Material. That is usually enough at this level.', 'Up material. Trade pieces and grind it.'],
  captureTrade: ['A trade. Slightly helps whoever has more space.', 'Even. Fine — I am happy to play a long game.'],
  captureDown: ['You came out behind on that one.', 'That loses a little material. Recoverable, but do not repeat it.'],
  development: ['Good. Get everyone out, then decide.', 'Developing. No rush from here.'],
  centerPawn: ['Central space. Small edge, and small edges are the job.', 'Good. Space is easier to play with.'],
  queenEarly: ['Bit early for the queen. She will get pushed around.', 'She is exposed there. Nothing fatal.'],
  retreat: ['A retreat is fine if the piece is better afterwards.', 'Backwards, but to a good square. That counts.'],
  quiet: ['Solid. Nothing wrong with improving quietly.', 'Patient. What is your worst-placed piece right now?'],
}

const KARPOV: Bank = {
  checkmate: ['Mate. The position had been won for some time.', 'It ends. It was decided many moves ago.'],
  check: ['A check. Rarely the strongest move.', 'You checked him. He has a comfortable square, I think.'],
  promotion: ['A queen. Now give him nothing.', 'Promoted. Take away his counterplay first, then win.'],
  castle: ['Good. Safety before ambition.', 'Castled. Now nothing can go wrong quickly.'],
  captureUp: ['Material. Quietly decisive.', 'You are ahead. Trade pieces, keep pawns.'],
  captureTrade: ['A trade. Which of you needed the pieces more?', 'Even exchange. It slightly helps him, I suspect.'],
  captureDown: ['You gave up more than you gained. Why?', 'That is material for activity. I would not have.'],
  development: ['Yes. Every piece to its best square.', 'Developing. No hurry. Nothing is threatened.'],
  centerPawn: ['The centre. Now do not let him undermine it.', 'Space. Guard it and it wins the game slowly.'],
  queenEarly: ['Too early. She will be a liability.', 'Bring her out when the position asks. It has not asked.'],
  retreat: ['A good retreat. The piece is safer and no worse.', 'Backwards is not weakness. It is often the strongest move.'],
  quiet: ['Quiet and correct. That is how positions are won.', 'You improved. What was he hoping to do next?'],
}

const POLGAR: Bank = {
  checkmate: ['Mate. Beautiful.', 'You finished it. That is the feeling.'],
  check: ['Check. Keep the pressure, do not let up.', 'Yes. Make him uncomfortable.'],
  promotion: ['A queen. Now go hunting.', 'Promoted. Finish with style.'],
  castle: ['Safe. Good, now we can really attack.', 'Castled. The fun starts now.'],
  captureUp: ['You won material. Use it aggressively.', 'Material. Do not sit on it, press.'],
  captureTrade: ['A trade. I would have looked for something sharper.', 'Even. Is there a combination you passed over?'],
  captureDown: ['You gave material. If that is a sacrifice, show me the follow-up.', 'Material down. Bold. Is it sound?'],
  development: ['Pieces out and pointing at his king. Good.', 'Develop, then strike. That is the order.'],
  centerPawn: ['Centre. Bold and correct.', 'Good, take space. Now look for the break.'],
  queenEarly: ['Early queen. Risky, and risky can work.', 'She is exposed. Do you have a reason?'],
  retreat: ['A retreat. There is usually something sharper.', 'Backwards. Look again — was there a tactic?'],
  quiet: ['Quiet. Is there really nothing here?', 'Safe move. I would have looked one more time for a combination.'],
}

const HOUYIFAN: Bank = {
  checkmate: ['Mate. Clear and well executed.', 'That is the game. Sound throughout.'],
  check: ['Check. Make sure it improves something.', 'Fine, but a check for its own sake achieves nothing.'],
  promotion: ['A queen. Stay accurate to the end.', 'Promoted. Calm technique now.'],
  castle: ['Good. King safety before anything else.', 'Castled. Structure is sound.'],
  captureUp: ['Material gained. Keep the position simple.', 'Up material. Reduce and convert.'],
  captureTrade: ['An even trade. Neutral, and neutral is acceptable.', 'Equal exchange. What does the structure look like now?'],
  captureDown: ['That loses material. Check the tactic again.', 'You came out behind. Recount it.'],
  development: ['Good, that piece belongs there.', 'Developing cleanly. Keep going.'],
  centerPawn: ['Central control. Well founded.', 'Good. Now support it properly.'],
  queenEarly: ['The queen is early. She will need time you do not have.', 'Premature. Finish developing first.'],
  retreat: ['A sound retreat. Repositioning is not a loss.', 'Backwards, and the square is better. Fine.'],
  quiet: ['A steady move. Structure holds.', 'Quiet. Is there a plan behind it, or just a pass?'],
}

const HARMON: Bank = {
  checkmate: ['Mate. It was on the ceiling the whole time.', 'There it is. You saw it.'],
  check: ['Check. Keep going, do not stop to admire it.', 'Yes. Where does it end?'],
  promotion: ['A queen. Now it should light up.', 'Promoted. Take it home.'],
  castle: ['Safe. Good, now I can see the attack.', 'Castled. Now the board opens up.'],
  captureUp: ['Material. That changes the whole picture.', 'You won it. Now play like you are winning.'],
  captureTrade: ['A trade. That made the position quieter, and I liked it loud.', 'Even. Was there something sharper there?'],
  captureDown: ['You gave up material. If you saw something, it had better be real.', 'Down material. Show me what you saw.'],
  development: ['Good, get it out. The pieces need to talk to each other.', 'Developing. Now imagine the position in six moves.'],
  centerPawn: ['Centre. That is where it starts.', 'Good. Now the whole board tilts.'],
  queenEarly: ['Early queen. Dangerous, and sometimes dangerous is right.', 'She is out. Do you have a picture of where this goes?'],
  retreat: ['A retreat. Sometimes that is the move nobody looks at.', 'Backwards. Did you check the forward one first?'],
  quiet: ['Quiet move. Is that really what the position is asking for?', 'Nothing happened there. Look again — something is available.'],
}

const BANKS: Record<string, Bank> = {
  kasparov: KASPAROV,
  fischer: FISCHER,
  carlsen: CARLSEN,
  karpov: KARPOV,
  polgar: POLGAR,
  houyifan: HOUYIFAN,
  harmon: HARMON,
}

/**
 * The coach's reaction to the move you just played.
 *
 * Indexed by move number rather than randomised: a reaction that changes on a
 * re-render reads as a glitch, and a deterministic pick is testable.
 */
export function coachReaction(coach: CoachProfile, move: Move, after: Chess, moveNumber: number): string {
  const bank = BANKS[coach.id] ?? CARLSEN
  const situation = classify(move, after, moveNumber)
  const lines = bank[situation]
  return lines[moveNumber % lines.length]
}

/** Every coach id has a bank — asserted in the test rather than assumed here. */
export const COVERED_COACH_IDS = Object.keys(BANKS)
export const ALL_COACH_IDS = COACHES.map((c) => c.id)
