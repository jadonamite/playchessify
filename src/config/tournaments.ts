// config/tournaments.ts
//
// Tournament definition: the shared scoring rules, plus the explicit registry of
// which events exist (see EVENTS below).
//
// Events are deliberately NOT derived from the clock. Each one is opened by hand
// — so between events there is simply no live tournament, and nothing starts
// itself.
//
// Two kinds of event run on the same engine:
//   • Grand Prix — the headline season. Small podium, big split (50/30/20).
//   • Qualifiers — an open event. Wide payout (10 × $5), and its top 100 form
//     the closed field for the Grand Prix that follows.
//
// Scoring is XP-based so everyone "starts from zero" each event and only ever
// climbs. XP per game is weighted by opponent strength (anti-farm + skill signal)
// and by soft daily volume caps. See src/lib/tournament.ts for the engine.

export interface TournamentSplit {
  place: number
  amount: number
}

export interface TournamentXpRules {
  win: number
  draw: number
  loss: number
  // opponent-strength weight = clamp(1 + (seedOpp - seedYou) / divisor, min, max)
  oppWeightDivisor: number
  oppWeightMin: number
  oppWeightMax: number
  // soft anti-farm: after `softCapGames` games in one UTC day, each further game
  // is worth `diminishingFactor ^ (n - softCapGames)` of its value.
  softCapGames: number
  diminishingFactor: number
  // a player must have played at least this many games in the window to be
  // eligible for a prize (one lucky win can't take the pot).
  minGamesEligible: number
}

export interface TournamentConfig {
  currency: string
  /** Defaults for an event that doesn't state its own economics. */
  prizePool: number
  splits: TournamentSplit[]
  xp: TournamentXpRules
  /** Length of one event, in ms. */
  seasonLengthMs: number
  /** Display timezone for start/end labels. */
  tzLabel: string
  tzOffsetMinutes: number
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export const TOURNAMENT: TournamentConfig = {
  currency: 'USD',
  prizePool: 100,
  splits: [
    { place: 1, amount: 50 },
    { place: 2, amount: 30 },
    { place: 3, amount: 20 },
  ],
  xp: {
    win: 10,
    draw: 4,
    loss: 1,
    oppWeightDivisor: 400,
    oppWeightMin: 0.5,
    oppWeightMax: 2.0,
    softCapGames: 10,
    diminishingFactor: 0.8,
    minGamesEligible: 3,
  },
  seasonLengthMs: WEEK_MS,
  tzLabel: 'WAT',
  tzOffsetMinutes: 60,
}

/** Flat 10 × $5 — the Qualifiers pay wide rather than deep. */
const QUALIFIER_SPLITS: TournamentSplit[] = Array.from({ length: 10 }, (_, i) => ({
  place: i + 1,
  amount: 5,
}))

export type TournamentStatus = 'upcoming' | 'live' | 'ended'
export type TournamentKind = 'grand-prix' | 'qualifiers'

export interface TournamentWindow {
  /** Display ordinal within its own kind: Grand Prix S2 → 2, Qualifiers Q1 → 1. */
  seasonIndex: number
  kind: TournamentKind
  id: string // 'S1' | 'Q1' — also the Redis key namespace
  /**
   * Season id used on-chain in TournamentRewards. Deliberately NOT `seasonIndex`:
   * the vault keys prizes by a single uint that must be unique across *every*
   * event, while display ids restart per kind (S1, Q1, S2…). Seeding Q1 against
   * id 1 would collide with Grand Prix S1's already-funded allocations.
   */
  contractSeasonId: number
  name: string // 'The Qualifiers'
  startsAt: number // ms (UTC)
  endsAt: number // ms (UTC)
  status: TournamentStatus
  prizePool: number
  currency: string
  splits: TournamentSplit[]
  /**
   * Qualifiers only — how many of this board's eligible players advance to the
   * next Grand Prix. Everyone tied on XP with the player at this rank advances
   * too, so the real count can exceed it (see src/lib/tournament.ts).
   */
  qualifyTopN?: number
  /** Grand Prix only — event id whose qualifier set gates this board. */
  qualifiersFrom?: string
}

interface EventEntry {
  seasonIndex: number
  kind: TournamentKind
  id: string
  contractSeasonId: number
  name: string
  startsAt: number
  prizePool?: number
  splits?: TournamentSplit[]
  qualifyTopN?: number
  qualifiersFrom?: string
}

/**
 * The event registry — the single source of truth for which events exist.
 *
 * Nothing is derived from the clock and nothing opens on its own: an event
 * exists only because it is listed here. Opening the next one is a deliberate
 * act — add an entry, ship it. The gap between two entries is the rest period;
 * no separate rule encodes it.
 */
const EVENTS: EventEntry[] = [
  // Grand Prix S1 — July 10–17 2026 WAT. Ran, closed, paid out.
  {
    seasonIndex: 1,
    kind: 'grand-prix',
    id: 'S1',
    contractSeasonId: 1,
    name: 'Weekly Grand Prix S1',
    startsAt: Date.UTC(2026, 6, 9, 23, 0, 0),
  },

  // The Qualifiers — Aug 2–9 2026 WAT. Open to everyone: top 10 share $50,
  // top 100 (plus ties at the line) take the Grand Prix S2 field.
  {
    seasonIndex: 1,
    kind: 'qualifiers',
    id: 'Q1',
    contractSeasonId: 2,
    name: 'The Qualifiers',
    startsAt: Date.UTC(2026, 7, 1, 23, 0, 0),
    prizePool: 50,
    splits: QUALIFIER_SPLITS,
    qualifyTopN: 100,
  },

  // Grand Prix S2 — Aug 10–17 2026 WAT, one day after the Qualifiers close.
  // Closed field: only Q1 qualifiers score.
  {
    seasonIndex: 2,
    kind: 'grand-prix',
    id: 'S2',
    contractSeasonId: 3,
    name: 'Weekly Grand Prix S2',
    startsAt: Date.UTC(2026, 7, 9, 23, 0, 0),
    qualifiersFrom: 'Q1',
  },
]

function buildWindow(e: EventEntry, status: TournamentStatus): TournamentWindow {
  return {
    seasonIndex: e.seasonIndex,
    kind: e.kind,
    id: e.id,
    contractSeasonId: e.contractSeasonId,
    name: e.name,
    startsAt: e.startsAt,
    endsAt: e.startsAt + TOURNAMENT.seasonLengthMs,
    status,
    prizePool: e.prizePool ?? TOURNAMENT.prizePool,
    currency: TOURNAMENT.currency,
    splits: e.splits ?? TOURNAMENT.splits,
    qualifyTopN: e.qualifyTopN,
    qualifiersFrom: e.qualifiersFrom,
  }
}

const registry = () =>
  [...EVENTS]
    .sort((a, b) => a.startsAt - b.startsAt)
    .map((e) => buildWindow(e, 'live'))

/**
 * The event running right now, or null between events (and before S1).
 * Null is the normal resting state, not an error.
 */
export function getActiveSeason(nowMs: number = Date.now()): TournamentWindow | null {
  const win = registry().find((w) => nowMs >= w.startsAt && nowMs < w.endsAt)
  return win ? { ...win, status: 'live' } : null
}

/** The most recently concluded event — whose board freezes and pays out. */
export function getLatestConcludedSeason(nowMs: number = Date.now()): TournamentWindow | null {
  const ended = registry().filter((w) => nowMs >= w.endsAt)
  const win = ended[ended.length - 1]
  return win ? { ...win, status: 'ended' } : null
}

/** The next scheduled event, if one has been put on the board yet. */
export function getNextSeason(nowMs: number = Date.now()): TournamentWindow | null {
  const win = registry().find((w) => nowMs < w.startsAt)
  return win ? { ...win, status: 'upcoming' } : null
}

/** Look an event up by id — used to resolve `qualifiersFrom`. */
export function getSeasonById(id: string): TournamentWindow | null {
  const e = EVENTS.find((x) => x.id === id)
  return e ? buildWindow(e, 'ended') : null
}
