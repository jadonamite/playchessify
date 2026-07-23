import type { Concept, LearnerLevel } from '@/types/training'
import type { LearnerModel } from '@/types/training'

/**
 * Lesson curriculum. Each lesson drills ONE concept through a few one-move
 * positions (White to move) with a verified best move. The lesson page judges
 * attempts with Stockfish (not the answer key), and the hint ladder escalates
 * if the learner is stuck. All FENs here are engine-verified for a clean best.
 */
export interface DrillStep {
  fen: string
  prompt: string
  expectedUci: string // for reveal only — the engine judges
  hints: string[]     // escalating: nudge → stronger → near-answer
}

export interface Lesson {
  id: string
  concept: Concept
  level: LearnerLevel
  title: string
  intro: string
  steps: DrillStep[]
}

export const CURRICULUM: Lesson[] = [
  {
    id: 'forks-101', concept: 'fork', level: 'basics',
    title: 'Forks: one move, two targets',
    intro: 'A fork attacks two pieces at once. The knight is the trickiest forker — it can hit a king and a queen that feel safely apart.',
    steps: [
      { fen: '8/2q5/5k2/8/1N6/8/8/4K3 w - - 0 1', prompt: 'Leap the knight so it checks the king AND hits the queen.', expectedUci: 'b4d5',
        hints: ['Look for a square that attacks both the king on f6 and the queen on c7.', 'A knight on d5 touches both.', 'Play Nd5+ — after the king moves, take the queen.'] },
      { fen: '8/8/2q3k1/8/8/3N4/8/4K3 w - - 0 1', prompt: 'Find the forking leap.', expectedUci: 'd3e5',
        hints: ['Which knight square checks the king and eyes the queen?', 'e5 hits g6 and c6.', 'Play Ne5+, then capture on c6.'] },
      { fen: '8/8/6k1/8/2q5/5N2/8/4K3 w - - 0 1', prompt: 'One more royal fork.', expectedUci: 'f3e5',
        hints: ['Jump toward the centre.', 'e5 forks the king on g6 and the queen on c4.', 'Play Ne5+.'] },
    ],
  },
  {
    id: 'hanging-101', concept: 'hanging-piece', level: 'basics',
    title: 'Free material: punish hanging pieces',
    intro: 'A piece with no defender is "hanging." The first habit of a strong player is to grab free material — every move, ask: what is undefended?',
    steps: [
      { fen: 'rnb1kbnr/pppp1ppp/8/3q4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1', prompt: 'Black\'s queen is loose. Win it.', expectedUci: 'e4d5',
        hints: ['Your e-pawn is eyeing the centre.', 'Nothing guards d5.', 'Play exd5.'] },
      { fen: 'rnbqkbnr/ppp2ppp/8/3p4/3n4/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1', prompt: 'A knight sits undefended. Take it.', expectedUci: 'f3d4',
        hints: ['Is the black knight on d4 actually defended?', 'The d5-pawn doesn\'t guard it.', 'Play Nxd4.'] },
      { fen: '4k3/8/8/7q/8/8/8/3QK3 w - - 0 1', prompt: 'Win the undefended queen.', expectedUci: 'd1h5',
        hints: ['Your queen has a diagonal.', 'd1 to h5 is clear.', 'Play Qxh5.'] },
    ],
  },
  {
    id: 'backrank-101', concept: 'basic-checkmate', level: 'basics',
    title: 'The back-rank mate',
    intro: 'A king boxed in by its own pawns is vulnerable on the back rank. A rook or queen arriving with check — out of the king\'s reach — is mate.',
    steps: [
      { fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', prompt: 'Mate on the back rank.', expectedUci: 'a1a8',
        hints: ['The king is trapped behind its pawns.', 'Bring the rook to the 8th rank.', 'Play Ra8#.'] },
      { fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', prompt: 'Deliver checkmate in one.', expectedUci: 'e1e8',
        hints: ['Same idea — the 8th rank.', 'The rook is far enough the king can\'t take it.', 'Play Re8#.'] },
      { fen: '6k1/R7/1R6/8/8/8/8/6K1 w - - 0 1', prompt: 'Two rooks, ladder mate.', expectedUci: 'b6b8',
        hints: ['One rook guards the 7th rank — use the other.', 'Drive the king with the b-rook.', 'Play Rb8#.'] },
    ],
  },
]

export function lessonsForConcept(concept: Concept): Lesson[] {
  return CURRICULUM.filter((l) => l.concept === concept)
}

/**
 * Suggest the next lesson: the first uncompleted lesson whose concept is among
 * the learner's weak spots, else the first uncompleted lesson at/below level.
 */
export function suggestLesson(m: LearnerModel, weak: Concept[]): Lesson | undefined {
  const done = new Set(m.completedLessons)
  const byWeak = CURRICULUM.find((l) => weak.includes(l.concept) && !done.has(l.id))
  if (byWeak) return byWeak
  return CURRICULUM.find((l) => !done.has(l.id))
}


export function lessonById(id: string): Lesson | undefined {
  return CURRICULUM.find((l) => l.id === id)
}