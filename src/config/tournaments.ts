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
  // Rule 1: Distinct-opponent floor — require ≥5 distinct opponents to be prize-eligible.
  minDistinctOpponents: number
  // Rule 2: Per-opponent XP cap — no single opponent may supply more than ~25% of your XP.
  maxOpponentXpShare: number
  // Rule 4: Discount wins over opponents with no wins in-window.
  noWinOpponentMinGames: number
  noWinOpponentDiscount: number
  /**
   * XP multiplier for the 1st, 2nd, 3rd… settled game against the *same*
   * opponent in one window; the final value repeats for every meeting after.
   *
   * Beating the same wallet twenty times is not twenty times the achievement,
   * and it is the whole shape of a wash-trading ring: two wallets, one always
   * losing, the wager returning to the same hand. Decaying repeats prices that
   * in without touching anyone who plays a friend a few times.
   */
  repeatOpponentWeights: number[]
}

/**
 * Loss-farm ("feeder") detection — accounts that exist only to lose, so a
 * partner wallet can harvest wins.
 *
 * This is enforcement of the published Terms §7 (Fair play: no collusion; "We
 * may exclude accounts or addresses that violate these rules"), not a new
 * scoring rule. It is written as thresholds rather than a hand-kept blacklist
 * so a flagged account can be shown exactly why it was flagged.
 */
export interface TournamentFeederRules {
  /** Zero wins across this many settled games in the window. */
  minGames: number
  /** …or zero wins across this many games against at most `maxOpponents`. */
  narrowGames: number
  maxOpponents: number
  /** Addresses always excluded, and addresses never excluded (manual review). */
  denylist: string[]
  allowlist: string[]
}

export interface TournamentConfig {
  currency: string
  /** Defaults for an event that doesn't state its own economics. */
  prizePool: number
  splits: TournamentSplit[]
  xp: TournamentXpRules
  feeder: TournamentFeederRules
  /**
   * Manual score override for addresses flagged for underhanded play (Terms
   * §7) that aren't caught by the feeder heuristics — e.g. engine assistance
   * rather than loss-farming. Unlike `feeder.denylist`, these wallets stay
   * visible on the board at the fixed XP given here (never their computed
   * XP), always ineligible for a prize, and carry the flagged badge in the UI.
   */
  flagged: Record<string, number>
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
    minDistinctOpponents: 5,
    maxOpponentXpShare: 0.25,
    noWinOpponentMinGames: 3,
    noWinOpponentDiscount: 0.2,
    // 1st meeting full, 2nd half, every one after that a tenth.
    repeatOpponentWeights: [1, 0.5, 0.1],
  },
  feeder: {
    // 5 games without a single win is already a 3% outcome for a real player;
    // every ring feeder found in Q1 sat at 6–10 games and zero wins.
    minGames: 5,
    // The tight version: a wallet that only ever plays one partner and loses.
    narrowGames: 3,
    maxOpponents: 1,
    denylist: [],
    allowlist: [],
  },
  flagged: {
    '0x9037f734e7a5a2c5e4d54c029d38f0982e48e817': 149,
  },
  seasonLengthMs: WEEK_MS,
  tzLabel: 'WAT',
  tzOffsetMinutes: 60,
}

/** Flat 10 × $10 — the Qualifiers pay wide rather than deep. */
const QUALIFIER_SPLITS: TournamentSplit[] = Array.from({ length: 10 }, (_, i) => ({
  place: i + 1,
  amount: 10,
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
  /**
   * Window length for this event alone, overriding TOURNAMENT.seasonLengthMs.
   *
   * Per-event rather than a change to the shared constant: seasonLengthMs is
   * applied at read time to every entry in the registry, so editing it would
   * retroactively move the end of events that have already run and frozen.
   */
  lengthMs?: number
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

  // The Qualifiers — Aug 2–13 2026 WAT. Open to everyone: top 10 share $100,
  // top 100 (plus ties at the line) take the Grand Prix S2 field.
  //
  // Runs eleven days rather than the standard week: the window was extended by
  // four days while the event was already open, so the board and its qualifier
  // set were unfrozen and are re-derived at the new close.
  //
  // Pool raised $50 → $100 (10×$10) after the event closed — applied
  // retroactively, so the frozen board is cleared and re-derived at the new
  // payout (see the K.final('Q1') clear that shipped alongside this change).
  {
    seasonIndex: 1,
    kind: 'qualifiers',
    id: 'Q1',
    contractSeasonId: 2,
    name: 'The Qualifiers',
    startsAt: Date.UTC(2026, 7, 1, 23, 0, 0),
    lengthMs: 11 * 24 * 60 * 60 * 1000, // ends Aug 12 23:00 UTC = Aug 13 00:00 WAT
    prizePool: 100,
    splits: QUALIFIER_SPLITS,
    qualifyTopN: 100,
  },

  // Grand Prix S2 — closed field, gated on Q1. Deliberately NOT listed yet:
  // it opens when we open it, not on a date set before Q1 finished. Add the
  // entry below when the call is made.
  //
  // {
  //   seasonIndex: 2,
  //   kind: 'grand-prix',
  //   id: 'S2',
  //   contractSeasonId: 3,
  //   name: 'Weekly Grand Prix S2',
  //   startsAt: <decide>,
  //   qualifiersFrom: 'Q1',
  // },
]

function buildWindow(e: EventEntry, status: TournamentStatus): TournamentWindow {
  return {
    seasonIndex: e.seasonIndex,
    kind: e.kind,
    id: e.id,
    contractSeasonId: e.contractSeasonId,
    name: e.name,
    startsAt: e.startsAt,
    endsAt: e.startsAt + (e.lengthMs ?? TOURNAMENT.seasonLengthMs),
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
