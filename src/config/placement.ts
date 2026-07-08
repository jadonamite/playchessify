import type { Concept, LearnerLevel } from '@/types/training'

/**
 * Placement diagnostic. Each item is a one-move puzzle (White to move) with a
 * single clear best move. The placement page judges the learner's move with
 * Stockfish (move == engine best, or loses little) rather than a hand-kept
 * accepted-move list — so scoring stays correct without brittle answer keys.
 *
 * `expectedUci` is for reference/reveal only; the engine is the judge.
 */
export interface PlacementItem {
  id: string
  fen: string
  concept: Concept
  level: LearnerLevel
  prompt: string
  expectedUci: string
}

export const PLACEMENT: PlacementItem[] = [
  {
    id: 'p1', concept: 'hanging-piece', level: 'basics',
    fen: 'rnb1kbnr/pppp1ppp/8/3q4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1',
    prompt: 'Black just left something undefended. Punish it.',
    expectedUci: 'e4d5',
  },
  {
    id: 'p2', concept: 'basic-checkmate', level: 'basics',
    fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
    prompt: 'Deliver checkmate in one.',
    expectedUci: 'e1e8',
  },
  {
    id: 'p3', concept: 'fork', level: 'basics',
    fen: '8/2q5/5k2/8/1N6/8/8/4K3 w - - 0 1',
    prompt: 'One knight move attacks the king and the queen at once.',
    expectedUci: 'b4d5',
  },
  {
    id: 'p4', concept: 'basic-checkmate', level: 'intermediate',
    fen: '6k1/R7/1R6/8/8/8/8/6K1 w - - 0 1',
    prompt: 'Mate the king with the two rooks.',
    expectedUci: 'b6b8',
  },
  {
    id: 'p5', concept: 'fork', level: 'intermediate',
    fen: '8/8/2q3k1/8/8/3N4/8/4K3 w - - 0 1',
    prompt: 'Find the knight leap that forks the king and queen.',
    expectedUci: 'd3e5',
  },
]

/**
 * Calculate the mastery score for a concept based on the solved status.
 */
function calculateMasteryScore(solved: boolean): number {
  return solved ? 0.6 : 0.15
}

/**
 * Calculate the level based on the number of solved items and intermediate items.
 */
function calculateLevel(solvedCount: number, interSolved: number): LearnerLevel {
  if (solvedCount >= 4 && interSolved >= 1) return 'intermediate'
  return 'basics'
}

/**
 * Turn per-item results into a placement outcome: a level and seed mastery
 * scores per concept. Solved → 0.6 mastery, missed → 0.15. Level rises with
 * the share solved (expert is reached through lessons, not placement).
 */
export function scorePlacement(
  results: { item: PlacementItem; solved: boolean }[],
): { level: LearnerLevel; concepts: Partial<Record<Concept, number>> } {
  const concepts: Partial<Record<Concept, number>> = {}
  let solvedCount = 0
  let interSolved = 0
  for (const { item, solved } of results) {
    const masteryScore = calculateMasteryScore(solved)
    concepts[item.concept] = Math.max(concepts[item.concept] ?? 0, masteryScore)
    if (solved) solvedCount++
    if (solved && item.level === 'intermediate') interSolved++
  }
  const level = calculateLevel(solvedCount, interSolved)
  return { level, concepts }
}