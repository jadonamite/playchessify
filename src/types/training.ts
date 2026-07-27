/** Training system shared types. */

export type LearnerLevel = 'basics' | 'intermediate' | 'expert'

/**
 * Concept taxonomy the curriculum + diagnostic tag against. Mastery is tracked
 * per concept as a 0..1 score in the learner model. Keep ids stable — they key
 * Redis data and lesson modules.
 */
export const CONCEPTS = [
  // basics
  'hanging-piece',     // leaving a piece undefended / giving away material
  'basic-checkmate',   // delivering / recognising mate
  'fork',
  'pin',
  'opening-principles',// develop, centre, castle
  // intermediate
  'skewer',
  'discovered-attack',
  'pawn-structure',
  'outpost',
  'king-pawn-endgame', // opposition, K+P
  // expert
  'prophylaxis',
  'calculation',
  'complex-endgame',
] as const

export type Concept = (typeof CONCEPTS)[number]

export const CONCEPT_LEVEL: Record<Concept, LearnerLevel> = {
  'hanging-piece': 'basics',
  'basic-checkmate': 'basics',
  'fork': 'basics',
  'pin': 'basics',
  'opening-principles': 'basics',
  'skewer': 'intermediate',
  'discovered-attack': 'intermediate',
  'pawn-structure': 'intermediate',
  'outpost': 'intermediate',
  'king-pawn-endgame': 'intermediate',
  'prophylaxis': 'expert',
  'calculation': 'expert',
  'complex-endgame': 'expert',
}

export const CONCEPT_LABEL: Record<Concept, string> = {
  'hanging-piece': 'hanging pieces',
  'basic-checkmate': 'basic checkmates',
  'fork': 'forks',
  'pin': 'pins',
  'opening-principles': 'opening principles',
  'skewer': 'skewers',
  'discovered-attack': 'discovered attacks',
  'pawn-structure': 'pawn structure',
  'outpost': 'outposts',
  'king-pawn-endgame': 'king & pawn endgames',
  'prophylaxis': 'prophylaxis',
  'calculation': 'calculation',
  'complex-endgame': 'complex endgames',
}

/** Persisted learner model (one per address). */
export interface LearnerModel {
  address: string
  coachId: string
  level: LearnerLevel
  /** Concept → mastery 0..1. Missing = 0 (untouched). */
  concepts: Partial<Record<Concept, number>>
  /** Lesson ids the learner has cleared. */
  completedLessons: string[]
  /** Has the placement test been taken? */
  placed: boolean
  /** ISO timestamps. */
  createdAt: string
  lastSession: string
}

export function emptyLearner(address: string, coachId = 'carlsen'): LearnerModel {
  const now = new Date().toISOString()
  return {
    address: address.toLowerCase(),
    coachId,
    level: 'basics',
    concepts: {},
    completedLessons: [],
    placed: false,
    createdAt: now,
    lastSession: now,
  }
}

/** Weakest N concepts (lowest mastery, untouched counts as 0), level-appropriate first. */
export function weakestConcepts(m: LearnerModel, n = 3): Concept[] {
  const levelOrder: LearnerLevel[] = ['basics', 'intermediate', 'expert']
  const maxLevel = levelOrder.indexOf(m.level)
  return (CONCEPTS as readonly Concept[])
    .filter((c) => levelOrder.indexOf(CONCEPT_LEVEL[c]) <= maxLevel)
    .map((c) => ({ c, score: m.concepts[c] ?? 0 }))
    .sort((a, b) => a.score - b.score)
    .slice(0, n)
    .map((x) => x.c)
}
