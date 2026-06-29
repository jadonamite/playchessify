/**
 * Single source of truth for the chess coaches.
 *
 * The landing page renders the presentational fields (name/elo/art/about…);
 * the training system reads `engine` (how the coach plays its own moves) and
 * `teaching` (how it instructs). Analysis/teaching *truth* always comes from
 * Stockfish — `engine` only flavours the coach's own (deliberately gentle)
 * replies, and `style` biases move selection toward the coach's personality.
 */

/* ── style personality ──────────────────────────────────────────────────────
 * Weights in 0..1 that bias evaluation / move-ordering toward a play style.
 * 0.5 is neutral. Consumed by the homegrown engine (src/lib/chess-engine.ts)
 * when the coach picks its own move. */
export interface StyleWeights {
  kingAttack: number // reward attacking the enemy king zone
  sacrifice: number  // tolerance for giving up material for initiative
  positional: number // reward piece-square / prophylactic quiet moves
  simplify: number   // reward trading down when ahead (endgame grind)
  forcing: number    // reward checks / captures / threats
}

/* ── engine config ──────────────────────────────────────────────────────────
 * Strength model for the coach's OWN moves. `depth` feeds the homegrown
 * minimax (capped ~3 in-browser). Instead of always playing the argmax, the
 * engine samples from the `topK` best moves with `temperature` — higher ELO →
 * smaller topK / lower temperature → fewer felt mistakes. */
export interface CoachEngine {
  depth: number
  topK: number
  temperature: number
  style: StyleWeights
}

/* ── teaching config ────────────────────────────────────────────────────────
 * `specialty` is the curriculum branch the coach emphasises. `voice` is the
 * persona system-prompt handed to the LLM voice layer (the LLM only phrases
 * engine facts — it never decides chess). */
export type Specialty = 'attack' | 'tactics' | 'positional' | 'endgame' | 'universal'

export interface CoachTeaching {
  specialty: Specialty
  voice: string
}

export interface CoachProfile {
  id: string
  name: string
  short: string // one-word label for the bubble map
  title: string
  elo: number
  accent: string
  rarity: string
  tags: string
  img: string // portrait art in /public/Coaches
  about: string
  engine: CoachEngine
  teaching: CoachTeaching
}

/** Backwards-compatible alias — the landing imports `Coach`. */
export type Coach = CoachProfile

export const COACHES: CoachProfile[] = [
  {
    id: 'kasparov', name: 'Garry Kasparov', short: 'Kasparov', title: 'The Attacker',
    elo: 2851, accent: '#fb7185', rarity: 'LEGENDARY',
    tags: 'Aggressive · Analytical · Dominant', img: '/Coaches/Garry Kasparov.webp',
    about: 'Kasparov plays like a storm — relentless attacks, razor-sharp preparation, and total mental dominance. Train with him to seize the initiative from move one, calculate forcing lines deep, and crush hesitation wherever you find it.',
    engine: { depth: 3, topK: 2, temperature: 0.15, style: { kingAttack: 0.95, sacrifice: 0.8, positional: 0.5, simplify: 0.3, forcing: 0.85 } },
    teaching: { specialty: 'attack', voice: 'You are Garry Kasparov coaching a student. Intense, demanding, electric. You prize the initiative and forcing play; you push the student to attack and calculate deeply. Never soft, but never cruel.' },
  },
  {
    id: 'fischer', name: 'Bobby Fischer', short: 'Fischer', title: 'The Genius',
    elo: 2785, accent: '#60a5fa', rarity: 'MYTHIC',
    tags: 'Uncompromising · Precise · Relentless', img: '/Coaches/Fischer.webp',
    about: 'Fischer demands pure, logical chess and nothing less. Learn clean principled play, surgical endgame technique, and the iron will to keep fighting for the win when others would take the draw.',
    engine: { depth: 3, topK: 2, temperature: 0.2, style: { kingAttack: 0.6, sacrifice: 0.45, positional: 0.8, simplify: 0.5, forcing: 0.8 } },
    teaching: { specialty: 'tactics', voice: 'You are Bobby Fischer coaching a student. Blunt, exacting, allergic to sloppiness. You demand clean logical chess and precise calculation. Praise is earned, not given.' },
  },
  {
    id: 'carlsen', name: 'Magnus Carlsen', short: 'Magnus', title: 'The Endgame',
    elo: 2882, accent: '#34d399', rarity: 'MYTHIC',
    tags: 'Pragmatic · Intuitive · Unshakeable', img: '/Coaches/Magnus.webp',
    about: 'Carlsen turns the smallest edge into a full point. Master the art of grinding — practical intuition, flawless endgames, and the calm endurance to outlast anyone across a long, patient battle.',
    engine: { depth: 3, topK: 1, temperature: 0.0, style: { kingAttack: 0.5, sacrifice: 0.4, positional: 0.85, simplify: 0.9, forcing: 0.55 } },
    teaching: { specialty: 'endgame', voice: 'You are Magnus Carlsen coaching a student. Calm, practical, quietly confident. You teach that small edges win games — good squares, clean technique, patience. Encouraging and matter-of-fact.' },
  },
  {
    id: 'karpov', name: 'Anatoly Karpov', short: 'Karpov', title: 'The Maverick',
    elo: 2780, accent: '#a78bfa', rarity: 'LEGENDARY',
    tags: 'Patient · Positional · Subtle', img: '/Coaches/Anatoly Karpov.webp',
    about: 'Karpov squeezes the life from a position before a single piece falls. Learn prophylaxis — quietly killing your opponent’s every idea — and the patience to coil tighter and tighter until they have nowhere left to move.',
    engine: { depth: 3, topK: 2, temperature: 0.2, style: { kingAttack: 0.35, sacrifice: 0.25, positional: 0.95, simplify: 0.6, forcing: 0.4 } },
    teaching: { specialty: 'positional', voice: 'You are Anatoly Karpov coaching a student. Quiet, precise, deeply positional. You teach prophylaxis — stopping the opponent\'s ideas before your own — and patient accumulation of small advantages.' },
  },
  {
    id: 'polgar', name: 'Judit Polgar', short: 'Polgar', title: 'The Tactician',
    elo: 2735, accent: '#f472b6', rarity: 'LEGENDARY',
    tags: 'Fearless · Creative · Sharp', img: '/Coaches/Judit Polgar.webp',
    about: 'Polgar attacks with fearless imagination and dazzling tactics. Sharpen your tactical vision, find the brilliant sacrifice no one else sees, and keep the pressure roaring until the enemy king has nowhere to hide.',
    engine: { depth: 2, topK: 3, temperature: 0.3, style: { kingAttack: 0.85, sacrifice: 0.9, positional: 0.4, simplify: 0.3, forcing: 0.9 } },
    teaching: { specialty: 'tactics', voice: 'You are Judit Polgar coaching a student. Bold, energetic, creative. You teach fearless tactics — spotting combinations, sacrifices, and forcing sequences. You celebrate daring.' },
  },
  {
    id: 'houyifan', name: 'Hou Yifan', short: 'Yifan', title: 'The Scholar',
    elo: 2686, accent: '#22d3ee', rarity: 'EPIC',
    tags: 'Versatile · Structured · Composed', img: '/Coaches/Hou Yifan.webp',
    about: 'Hou Yifan plays a calm, universal game built on rock-solid foundations. Train well-rounded positional understanding, clean structure, and the ice-cool composure to calculate clearly under any pressure.',
    engine: { depth: 2, topK: 3, temperature: 0.35, style: { kingAttack: 0.5, sacrifice: 0.45, positional: 0.7, simplify: 0.55, forcing: 0.55 } },
    teaching: { specialty: 'universal', voice: 'You are Hou Yifan coaching a student. Composed, structured, clear. You teach well-rounded fundamentals — sound structure, calm calculation, and balanced judgement. Patient and methodical.' },
  },
  {
    id: 'harmon', name: 'Beth Harmon', short: 'Beth', title: 'The Prodigy',
    elo: 2650, accent: '#fbbf24', rarity: 'EPIC',
    tags: 'Visionary · Daring · Instinctive', img: '/Coaches/Beth Harmon.webp',
    about: 'Harmon sees the whole board light up before she touches a piece. Train bold intuitive leaps, fearless attacking lines, and the rare nerve to find brilliance — and to recover when a blunder threatens to bring it all down.',
    engine: { depth: 2, topK: 4, temperature: 0.45, style: { kingAttack: 0.8, sacrifice: 0.75, positional: 0.45, simplify: 0.4, forcing: 0.7 } },
    teaching: { specialty: 'attack', voice: 'You are Beth Harmon coaching a student. Intuitive, visionary, a little intense. You teach seeing the whole board at once — bold imaginative play — and the nerve to recover from a mistake.' },
  },
]

const COACHES_BY_ID: Record<string, CoachProfile> = Object.fromEntries(
  COACHES.map((c) => [c.id, c]),
)

/** Look up a coach by id; falls back to Magnus (the v1 default teacher). */
export function getCoach(id: string | null | undefined): CoachProfile {
  return (id && COACHES_BY_ID[id]) || COACHES_BY_ID['carlsen']
}
