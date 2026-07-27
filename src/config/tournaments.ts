// config/tournaments.ts
//
// Tournament ("Weekly Grand Prix") definition: the prize/scoring rules, plus the
// explicit registry of which seasons exist (see SEASONS below).
//
// Seasons are deliberately NOT derived from the clock. The Grand Prix runs one
// week on, one week off, and each season is opened by hand — so between seasons
// there is simply no live tournament, and nothing starts itself.
//
// Scoring is XP-based so everyone "starts from zero" each season and only ever
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
  /** Base display name; the season id (S1, S2…) is appended per window. */
  name: string
  currency: string
  prizePool: number
  splits: TournamentSplit[]
  xp: TournamentXpRules
  /** Length of one season, in ms. */
  seasonLengthMs: number
  /** Display timezone for start/end labels. */
  tzLabel: string
  tzOffsetMinutes: number
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

// Season 1 opens July 10 2026 00:00 WAT (UTC+1) → July 9 2026 23:00 UTC.
const SEASON_1_EPOCH_MS = Date.UTC(2026, 6, 9, 23, 0, 0)

export const TOURNAMENT: TournamentConfig = {
  name: 'Weekly Grand Prix',
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

export type TournamentStatus = 'upcoming' | 'live' | 'ended'

export interface TournamentWindow {
  seasonIndex: number
  id: string // 'S1'
  name: string // 'Weekly Grand Prix S1'
  startsAt: number // ms (UTC)
  endsAt: number // ms (UTC)
  status: TournamentStatus
  prizePool: number
  currency: string
  splits: TournamentSplit[]
}

/**
 * The season registry — the single source of truth for which seasons exist.
 *
 * The Grand Prix runs one week on, one week off: the rest week keeps it an
 * event rather than a grind. That cadence is NOT derived from the clock, and
 * seasons never open on their own — a season exists only because it is listed
 * here. Opening the next one is a deliberate act: add an entry, ship it.
 *
 * The gap between two entries is the rest week; no separate rule encodes it.
 */
const SEASONS: { seasonIndex: number; startsAt: number }[] = [
  // S1 — July 10–17 2026 WAT. Ran and closed; winners pending payout.
  { seasonIndex: 1, startsAt: SEASON_1_EPOCH_MS },

  // S2 opens when we say so — one week off after S1 at the earliest:
  // { seasonIndex: 2, startsAt: Date.UTC(2026, 6, 23, 23, 0, 0) },
]

function buildWindow(seasonIndex: number, startsAt: number, status: TournamentStatus): TournamentWindow {
  const id = `S${seasonIndex}`
  return {
    seasonIndex,
    id,
    name: `${TOURNAMENT.name} ${id}`,
    startsAt,
    endsAt: startsAt + TOURNAMENT.seasonLengthMs,
    status,
    prizePool: TOURNAMENT.prizePool,
    currency: TOURNAMENT.currency,
    splits: TOURNAMENT.splits,
  }
}

const registry = () =>
  [...SEASONS]
    .sort((a, b) => a.startsAt - b.startsAt)
    .map((s) => buildWindow(s.seasonIndex, s.startsAt, 'live'))

/** The next scheduled season, if one has been put on the board yet. */
export function getNextSeason(nowMs: number = Date.now()): TournamentWindow | null {
  const win = registry().find((w) => nowMs < w.startsAt)
  return win ? { ...win, status: 'upcoming' } : null
}


/** The most recently concluded season — whose board freezes and pays out. */
export function getLatestConcludedSeason(nowMs: number = Date.now()): TournamentWindow | null {
  const ended = registry().filter((w) => nowMs >= w.endsAt)
  const win = ended[ended.length - 1]
  return win ? { ...win, status: 'ended' } : null
}

/**
 * The season running right now, or null during a rest week (and before S1).
 * Null is the normal resting state, not an error.
 */
export function getActiveSeason(nowMs: number = Date.now()): TournamentWindow | null {
  const win = registry().find((w) => nowMs >= w.startsAt && nowMs < w.endsAt)
  return win ? { ...win, status: 'live' } : null
}