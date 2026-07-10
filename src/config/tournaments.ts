// config/tournaments.ts
//
// Recurring tournament ("Weekly Grand Prix") definition. The app never hardcodes
// a single event — it stores one cadence + prize rule here and derives *which*
// season is live right now from the clock (getTournamentAt). Next week rolls to
// the next season on its own; nothing needs to be touched between tournaments.
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
  /** Start of Season 1, in UTC ms. Everything is derived from this anchor. */
  epochMs: number
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
  epochMs: SEASON_1_EPOCH_MS,
  seasonLengthMs: WEEK_MS,
  tzLabel: 'WAT',
  tzOffsetMinutes: 60,
}

export type TournamentStatus = 'upcoming' | 'live'

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

/**
 * Derive the tournament season live at `nowMs`. Seasons run back-to-back from the
 * epoch, so there is always exactly one current season (once the epoch passes).
 */
export function getTournamentAt(nowMs: number = Date.now()): TournamentWindow {
  const { epochMs, seasonLengthMs } = TOURNAMENT
  if (nowMs < epochMs) {
    // Before S1 opens — advertise S1 as upcoming.
    return buildWindow(1, epochMs, 'upcoming')
  }
  const idx = Math.floor((nowMs - epochMs) / seasonLengthMs)
  return buildWindow(idx + 1, epochMs + idx * seasonLengthMs, 'live')
}

/** The season immediately before `win`, or null if `win` is Season 1. */
export function previousWindow(win: TournamentWindow): TournamentWindow | null {
  if (win.seasonIndex <= 1) return null
  return buildWindow(win.seasonIndex - 1, win.startsAt - TOURNAMENT.seasonLengthMs, 'live')
}
