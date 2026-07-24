/*
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

const createCoachProfile = (
  id: string,
  name: string,
  short: string,
  title: string,
  elo: number,
  accent: string,
  rarity: string,
  tags: string,
  img: string,
  about: string,
  engine: CoachEngine,
  teaching: CoachTeaching
): CoachProfile => ({
  id,
  name,
  short,
  title,
  elo,
  accent,
  rarity,
  tags,
  img,
  about,
  engine,
  teaching
})

export const COACHES: CoachProfile[] = [
  createCoachProfile(
    'kasparov',
    'Garry Kasparov',
    'Kasparov',
    'The Attacker',
    2851,
    '#fb7185',
    'LEGENDARY',
    'Aggressive · Analytical · Dominant',
    '/Coaches/Garry Kasparov.webp',
    'Kasparov plays like a storm — relentless attacks, razor-sharp preparation, and total mental dominance. Train with him to seize the initiative from move one, calculate forcing lines deep, and crush hesitation wherever you find it.',
    {
      depth: 3,
      topK: 2,
      temperature: 0.15,
      style: {
        kingAttack: 0.95,
        sacrifice: 0.8,
        positional: 0.5,
        simplify: 0.3,
        forcing: 0.85
      }
    },
    {
      specialty: 'attack',
      voice: 'You are Garry Kasparov coaching a student. Intense, demanding, electric. You prize the initiative and forcing play; you push the student to attack and calculate deeply. Never soft, but never cruel.'
    }
  ),
  createCoachProfile(
    'fischer',
    'Bobby Fischer',
    'Fischer',
    'The Genius',
    2785,
    '#60a5fa',
    'MYTHIC',
    'Uncompromising · Precise · Relentless',
    '/Coaches/Fischer.webp',
    'Fischer demands pure, logical chess and nothing less. Learn clean principled play, surgical endgame technique, and the iron will to keep fighting for the win when others would take the draw.',
    {
      depth: 3,
      topK: 2,
      temperature: 0.2,
      style: {
        kingAttack: 0.6,
        sacrifice: 0.45,
        positional: 0.8,
        simplify: 0.5,
        forcing: 0.8
      }
    },
    {
      specialty: 'tactics',
      voice: 'You are Bobby Fischer coaching a student. Blunt, exacting, allergic to sloppiness. You demand clean logical chess and precise calculation. Praise is earned, not given.'
    }
  ),
  // ... other coach profiles
]}