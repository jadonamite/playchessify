import { Redis } from '@upstash/redis'
import type { Abi } from 'viem'
import { getPublicClient } from '@/lib/celo-server'
import { syncGameIndex, getIndexedPlayers } from '@/lib/game-index'
import { CELO_CONTRACTS } from '@/config/contracts'
import { isBotAddress } from '@/config/bots'
import { CHESS_GAME_ABI } from '@/config/abis'
import {
  TOURNAMENT,
  getActiveSeason,
  getLatestConcludedSeason,
  getNextSeason,
  getSeasonById,
  type TournamentWindow,
} from '@/config/tournaments'

// ─────────────────────────────────────────────────────────────────────────────
// Tournament engine. Reuses the on-chain game index. Each season scores every
// game *created within its window* with weighted XP:
//
//   XP = base(result) × opponentWeight(seedRatings) × diminishing(gamesThatDay)
//
// Everyone starts each season at 0 XP. "Seed ratings" are a one-time snapshot of
// player ratings taken lazily when the season is first viewed, so opponent
// weighting is stable and un-gameable for the whole window. The chain has no
// per-game rating history, which is exactly why we seed once at open.
// ─────────────────────────────────────────────────────────────────────────────

const GAME = CELO_CONTRACTS.game as `0x${string}`
const BASE_RATING = 1200 // contract's starting ELO; fallback seed for late joiners
const SCAN_CHUNK = 200
const BOARD_TTL = 20 // seconds — live board cache; stats move slowly

// Result / status enum (mirrors PlaychessifyEngine + src/lib/celo-server.ts)
const RESULT_WHITE_WINS = 1
const RESULT_DRAW = 3
const STATUS_FINISHED = 2
const STATUS_DRAW = 4

const K = {
  seed: (id: string) => `chess:trn:${id}:seed`,
  board: (id: string) => `chess:trn:${id}:board`,
  final: (id: string) => `chess:trn:${id}:final`,
  qualifiers: (id: string) => `chess:trn:${id}:qualifiers`,
}

let _redis: Redis | null = null
function getRedis(): Redis {
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('[tournament] Upstash env not configured')
  _redis = new Redis({ url, token })
  return _redis
}

export interface BoardEntry {
  address: string
  xp: number
  wins: number
  losses: number
  draws: number
  games: number
  distinctOpponents: number
  eligible: boolean
  rank: number
  /** Manually flagged for underhanded play (Terms §7) — xp is a fixed override, never earned. */
  flagged?: boolean
}

export interface PrizeWinner {
  place: number
  address: string
  amount: number
}

export interface TournamentBoard {
  /** null during a rest week — no season is running. */
  window: TournamentWindow | null
  board: BoardEntry[]
  winners: PrizeWinner[]
  frozen: boolean
  /**
   * Addresses excluded as loss-farms under Terms §7, kept on the payload so an
   * exclusion can be reviewed and challenged rather than silently applied.
   */
  excluded?: string[]
  cached?: boolean
  /** Set only when idle, and only once the next season has been scheduled. */
  next?: TournamentWindow | null
}

// ── seed ratings ─────────────────────────────────────────────────────────────

/**
 * Ratings snapshot for a season, captured once on first read after it opens.
 * Used only for opponent-strength weighting, never for the score itself.
 */
/** Every indexed player's rating as of right now, straight from the chain. */
async function fetchCurrentRatings(): Promise<Record<string, number>> {
  await syncGameIndex()
  const addresses = await getIndexedPlayers()
  const out: Record<string, number> = {}
  if (addresses.length === 0) return out

  const stats = await getPublicClient().multicall({
    contracts: addresses.map((addr) => ({
      address: GAME,
      abi: CHESS_GAME_ABI as Abi,
      functionName: 'playerStats',
      args: [addr as `0x${string}`],
    })),
    allowFailure: true,
  })
  addresses.forEach((addr, i) => {
    const r = stats[i]
    if (r.status !== 'success') return
    const rating = Number((r.result as readonly bigint[])[3])
    out[addr.toLowerCase()] = rating || BASE_RATING
  })
  return out
}

async function getSeedRatings(win: TournamentWindow): Promise<Record<string, number>> {
  const redis = getRedis()
  const existing = await redis.hgetall<Record<string, number>>(K.seed(win.id))
  if (existing && Object.keys(existing).length > 0) {
    // Upstash may hand back string values — coerce.
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(existing)) out[k] = Number(v)
    return out
  }

  const seed = await fetchCurrentRatings()
  if (Object.keys(seed).length > 0) await redis.hset(K.seed(win.id), seed)
  return seed
}

// ── window game scan ─────────────────────────────────────────────────────────

interface WindowGame {
  id: number
  white: string
  black: string
  status: number
  result: number
  playedAt: number // unix seconds (v2 stores createdAt as a timestamp)
}

// The retired v1 contract. Seasons whose window opened before the v2 cutover
// have games on both contracts, so those windows scan v1 too. v1 stored
// `createdAt` as a **block number**, so its scan maps block → time from
// measured block time — accurate to seconds over recent history.
const V1_GAME = '0xb37877A9EBD6C3169b2eAAa3E16852839785aE85' as `0x${string}`
const V2_CUTOVER_MS = Date.UTC(2026, 6, 13, 6, 0, 0)

// v1's Game struct has no `joinedAt`, so v2's ABI cannot decode it — the v1
// scan must use v1's own shape.
const V1_GAME_ABI = [
  {
    type: 'function', name: 'gameNonce', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'getGame', stateMutability: 'view',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'white', type: 'address' },
        { name: 'black', type: 'address' },
        { name: 'wager', type: 'uint256' },
        { name: 'status', type: 'uint8' },
        { name: 'result', type: 'uint8' },
        { name: 'createdAt', type: 'uint256' },
        { name: 'drawProposer', type: 'address' },
      ],
    }],
  },
] as const

async function getBlockToTimeMapper(): Promise<(block: number) => number> {
  const pub = getPublicClient()
  const latest = await pub.getBlock()
  const L = Number(latest.number)
  const tL = Number(latest.timestamp)
  const olderNum = Math.max(0, L - 2_000_000)
  const older = await pub.getBlock({ blockNumber: BigInt(olderNum) })
  const O = Number(older.number)
  const tO = Number(older.timestamp)
  const blockTime = O < L ? (tL - tO) / (L - O) : 1 // secs/block; Celo L2 fallback
  return (block: number) => Math.round(tL - (L - block) * blockTime)
}

/**
 * All settled games on one contract played within [startMs, endMs]. Games are
 * created in id order so their `createdAt` is monotonic — we scan newest-first
 * and stop once a whole chunk predates the window, bounding work to the window
 * size. `toSec` maps raw createdAt to unix seconds (identity on v2, block →
 * time on v1).
 *
 * `strict` decides what a failed read means. A dropped `getGame` is
 * indistinguishable from a game that was never played, so on a lenient read
 * (the live board) we skip it and keep the page up, while on a strict read (the
 * freeze, which decides payout) we throw rather than score a partial window.
 */
async function scanContractWindow(
  game: `0x${string}`,
  abi: Abi,
  toSec: (createdAt: number) => number,
  startMs: number,
  endMs: number,
  strict = false,
): Promise<WindowGame[]> {
  const pub = getPublicClient()
  const nonceRaw = (await pub.readContract({ address: game, abi, functionName: 'gameNonce' })) as bigint
  const lastId = Number(nonceRaw) - 1
  if (lastId < 0) return []

  const startSec = Math.floor(startMs / 1000)
  const endSec = Math.floor(endMs / 1000)

  const games: WindowGame[] = []
  for (let end = lastId; end >= 0; end -= SCAN_CHUNK) {
    const start = Math.max(0, end - SCAN_CHUNK + 1)
    const ids = Array.from({ length: end - start + 1 }, (_, i) => BigInt(start + i))
    const results = await pub.multicall({
      contracts: ids.map((id) => ({ address: game, abi, functionName: 'getGame', args: [id] })),
      allowFailure: true,
    })

    let chunkMaxSec = 0
    let failures = 0
    results.forEach((r, i) => {
      if (r.status !== 'success') {
        failures += 1
        return
      }
      const g = r.result as { white: string; black: string; status: number; result: number; createdAt: bigint }
      const playedAt = toSec(Number(g.createdAt))
      if (playedAt > chunkMaxSec) chunkMaxSec = playedAt
      if (playedAt < startSec || playedAt > endSec) return
      games.push({
        id: Number(ids[i]),
        white: (g.white ?? '').toLowerCase(),
        black: (g.black ?? '').toLowerCase(),
        status: Number(g.status),
        result: Number(g.result),
        playedAt,
      })
    })

    if (failures > 0) {
      const range = `${start}–${end}`
      if (strict) {
        throw new Error(
          `[tournament] strict scan of ${game}: ${failures}/${ids.length} getGame reads failed in id range ${range}`,
        )
      }
      console.warn(`[tournament] scan of ${game}: ${failures}/${ids.length} getGame reads failed in id range ${range} — games may be missing`)
    }

    // Whole chunk predates the window — nothing older can qualify. A partially
    // failed chunk can understate its own max, so never break on one: the
    // dropped reads could be the in-window games we are looking for.
    if (failures === 0 && chunkMaxSec > 0 && chunkMaxSec < startSec) break
  }
  return games
}

/** All settled games played within [startMs, endMs] — v2, plus the retired v1
 *  contract for windows that opened before the cutover. `strict` propagates to
 *  the scans: see scanContractWindow. */
async function collectWindowGames(startMs: number, endMs: number, strict = false): Promise<WindowGame[]> {
  const scans = [scanContractWindow(GAME, CHESS_GAME_ABI as Abi, (t) => t, startMs, endMs, strict)]
  if (startMs < V2_CUTOVER_MS) {
    scans.push(getBlockToTimeMapper().then((toSec) => scanContractWindow(V1_GAME, V1_GAME_ABI as Abi, toSec, startMs, endMs, strict)))
  }
  const games = (await Promise.all(scans)).flat()

  // Chronological order so daily diminishing counts games as they happened.
  games.sort((a, b) => a.playedAt - b.playedAt || a.id - b.id)
  return games
}

// ── scoring ──────────────────────────────────────────────────────────────────

const ZERO = '0x0000000000000000000000000000000000000000'

const settled = (g: WindowGame) =>
  g.status === STATUS_DRAW || g.result === RESULT_DRAW || g.status === STATUS_FINISHED
const isDrawGame = (g: WindowGame) => g.status === STATUS_DRAW || g.result === RESULT_DRAW
const playable = (g: WindowGame) =>
  Boolean(g.white) && Boolean(g.black) && g.white !== ZERO && g.black !== ZERO

/** Unordered pair key, so A-vs-B and B-vs-A are the same matchup. */
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/**
 * Loss-farm ("feeder") detection — accounts that exist only to lose, so a
 * partner wallet can harvest wins — Terms §7.
 *
 * Rule 5: Zero wins across ≥5 games flags all ring feeders; ≥3 games against ≤1 opponent catches narrow rings.
 * Flagged wallets score nothing, and games against them award nothing, so the
 * farm stops paying on both sides.
 */
export function detectFeeders(games: WindowGame[]): string[] {
  const f = TOURNAMENT.feeder
  const allow = new Set(f.allowlist.map((a) => a.toLowerCase()))
  const deny = f.denylist.map((a) => a.toLowerCase())

  const rec: Record<string, { wins: number; games: number; opps: Set<string> }> = {}
  const get = (a: string) => (rec[a] ??= { wins: 0, games: 0, opps: new Set() })

  for (const g of games) {
    if (!settled(g) || !playable(g)) continue
    for (const [me, them] of [[g.white, g.black], [g.black, g.white]] as const) {
      const r = get(me)
      r.games += 1
      r.opps.add(them)
    }
    if (!isDrawGame(g)) get(g.result === RESULT_WHITE_WINS ? g.white : g.black).wins += 1
  }

  const flagged = new Set(deny)
  for (const [addr, r] of Object.entries(rec)) {
    if (r.wins > 0 || allow.has(addr)) continue
    const broad = r.games >= f.minGames
    const narrow = r.games >= f.narrowGames && r.opps.size <= f.maxOpponents
    if (broad || narrow) flagged.add(addr)
  }
  return [...flagged]
}

function scoreWindow(
  games: WindowGame[],
  seed: Record<string, number>,
): { board: BoardEntry[]; excluded: string[] } {
  const x = TOURNAMENT.xp
  const seedOf = (a: string) => seed[a] ?? BASE_RATING
  const clamp = (v: number) => Math.min(x.oppWeightMax, Math.max(x.oppWeightMin, v))

  const excluded = detectFeeders(games)
  const isExcluded = new Set(excluded)

  // Rule 4 pre-pass: Tally total wins and games per opponent in-window to detect 0-win opponents.
  const oppStats: Record<string, { wins: number; games: number }> = {}
  for (const g of games) {
    if (!settled(g) || !playable(g)) continue
    if (isExcluded.has(g.white) || isExcluded.has(g.black)) continue
    const w = (oppStats[g.white] ??= { wins: 0, games: 0 })
    const b = (oppStats[g.black] ??= { wins: 0, games: 0 })
    w.games += 1
    b.games += 1
    if (!isDrawGame(g)) {
      const winner = g.result === RESULT_WHITE_WINS ? g.white : g.black
      oppStats[winner].wins += 1
    }
  }

  // Rule 3: Nth meeting with the same opponent, this window. 1st=100%, 2nd=50%, 3rd+=10%.
  const rw = x.repeatOpponentWeights
  const meetings: Record<string, number> = {}
  const repeatWeight = (a: string, b: string) => {
    const n = (meetings[pairKey(a, b)] = (meetings[pairKey(a, b)] ?? 0) + 1)
    return rw[Math.min(n, rw.length) - 1] ?? rw[rw.length - 1] ?? 0.1
  }

  interface Acc {
    wins: number
    losses: number
    draws: number
    games: number
    opponents: Set<string>
    xpPerOpponent: Record<string, number>
    perDay: Record<number, number>
  }
  const acc: Record<string, Acc> = {}
  const get = (a: string): Acc =>
    (acc[a] ??= {
      wins: 0,
      losses: 0,
      draws: 0,
      games: 0,
      opponents: new Set(),
      xpPerOpponent: {},
      perDay: {},
    })

  const award = (player: string, opp: string, base: number, day: number, repeat: number, isWin: boolean = false) => {
    if (!player || player === ZERO) return
    const a = get(player)
    a.opponents.add(opp)
    const weight = clamp(1 + (seedOf(opp) - seedOf(player)) / x.oppWeightDivisor)
    const n = (a.perDay[day] = (a.perDay[day] ?? 0) + 1)
    const dim = n <= x.softCapGames ? 1 : Math.pow(x.diminishingFactor, n - x.softCapGames)

    // Rule 4: Discount wins over opponents with no wins in-window (if opp has >= noWinOpponentMinGames)
    let winDiscount = 1.0
    if (isWin) {
      const oppWinCount = oppStats[opp]?.wins ?? 0
      const oppGameCount = oppStats[opp]?.games ?? 0
      if (oppWinCount === 0 && oppGameCount >= x.noWinOpponentMinGames) {
        winDiscount = x.noWinOpponentDiscount
      }
    }

    const earnedXp = base * weight * dim * repeat * winDiscount
    a.xpPerOpponent[opp] = (a.xpPerOpponent[opp] ?? 0) + earnedXp
    a.games += 1
  }

  for (const g of games) {
    if (!settled(g) || !playable(g)) continue
    // A flagged loss-farm scores nothing and pays nothing to whoever played it.
    if (isExcluded.has(g.white) || isExcluded.has(g.black)) continue
    const isDraw = isDrawGame(g)
    const day = Math.floor(g.playedAt / 86400)
    const repeat = repeatWeight(g.white, g.black)

    if (isDraw) {
      award(g.white, g.black, x.draw, day, repeat, false)
      award(g.black, g.white, x.draw, day, repeat, false)
      get(g.white).draws += 1
      get(g.black).draws += 1
    } else {
      const winner = g.result === RESULT_WHITE_WINS ? g.white : g.black
      const loser = winner === g.white ? g.black : g.white
      award(winner, loser, x.win, day, repeat, true)
      award(loser, winner, x.loss, day, repeat, false)
      get(winner).wins += 1
      get(loser).losses += 1
    }
  }

  // Rule 2: Per-opponent XP cap — no single opponent may supply > 25% of your XP.
  // Rule 1: Distinct-opponent floor — require >= 5 distinct opponents to be prize-eligible.
  const board: BoardEntry[] = Object.entries(acc)
    .filter(([address]) => !isBotAddress(address))
    .map(([address, a]) => {
      const rawTotalXp = Object.values(a.xpPerOpponent).reduce((sum, v) => sum + v, 0)
      let finalXp = 0
      if (rawTotalXp > 0) {
        const maxAllowedPerOpp = rawTotalXp * x.maxOpponentXpShare // e.g. 0.25 (25%)
        finalXp = Object.values(a.xpPerOpponent).reduce(
          (sum, oppXp) => sum + Math.min(oppXp, maxAllowedPerOpp),
          0,
        )
      }
      const distinctOpponents = a.opponents.size
      const eligible = a.games >= x.minGamesEligible && distinctOpponents >= x.minDistinctOpponents

      const flaggedScore = TOURNAMENT.flagged[address]
      const flagged = flaggedScore !== undefined

      return {
        address,
        xp: flagged ? flaggedScore : Math.round(finalXp),
        wins: a.wins,
        losses: a.losses,
        draws: a.draws,
        games: a.games,
        distinctOpponents,
        eligible: flagged ? false : eligible,
        rank: 0,
        ...(flagged ? { flagged: true } : {}),
      }
    })

  // Highest XP first; fewer games breaks ties (efficiency over volume).
  board.sort((p, q) => q.xp - p.xp || p.games - q.games)
  board.forEach((e, i) => (e.rank = i + 1))
  return { board, excluded }
}

function prizeWinners(board: BoardEntry[], win: TournamentWindow): PrizeWinner[] {
  const eligible = board.filter((e) => e.eligible)
  return win.splits
    .map((s) => {
      const e = eligible[s.place - 1]
      return e ? { place: s.place, address: e.address, amount: s.amount } : null
    })
    .filter((w): w is PrizeWinner => w !== null)
}

// ── public API ───────────────────────────────────────────────────────────────

/**
 * Collapse linked addresses onto one identity before scoring.
 *
 * A Privy user can hold both an embedded EOA and a smart account, and games can
 * land under either. Scoring the raw on-chain addresses splits that player in
 * two — each half carrying part of their games. With a 3-game eligibility floor
 * a genuinely active player can then qualify under neither half and silently
 * lose their prize. /api/profile/link already records the pairing; honour it
 * here so the leaderboard counts a person, not an address.
 */
async function resolveAliases(games: WindowGame[]): Promise<WindowGame[]> {
  const addrs = [...new Set(games.flatMap((g) => [g.white.toLowerCase(), g.black.toLowerCase()]))]
  if (addrs.length === 0) return games

  const redis = getRedis()
  let targets: (string | null)[]
  try {
    targets = await redis.mget<(string | null)[]>(...addrs.map((a) => `chess:profile:alias:${a}`))
  } catch (err) {
    // A failed alias read must not silently re-split identities — score the raw
    // addresses rather than dropping games, and make the degradation visible.
    console.error('[tournament] alias resolution failed, scoring raw addresses:', (err as Error)?.message)
    return games
  }

  const canonical = new Map<string, string>()
  addrs.forEach((a, i) => {
    const t = targets[i]
    if (t) canonical.set(a, String(t).toLowerCase())
  })
  if (canonical.size === 0) return games

  const to = (a: string) => canonical.get(a.toLowerCase()) ?? a.toLowerCase()
  return games.map((g) => ({ ...g, white: to(g.white), black: to(g.black) }))
}

// ── qualification ────────────────────────────────────────────────────────────

/**
 * Who advances from a Qualifiers board: the top `qualifyTopN` eligible players,
 * **plus everyone tied on XP with the player sitting on that line**.
 *
 * The tie clause is not a nicety. XP clusters hard in the tail — S1 had seven
 * players on 21 XP straddling rank 100 — and the board's tiebreak is "fewer
 * games played". Cutting strictly at N would hand the last seat to whoever
 * played least among equals and send the rest home on a rule that has nothing
 * to do with how they did. So the seat count floats; only the cash is fixed.
 */
function qualifiersFromBoard(board: BoardEntry[], topN: number): string[] {
  const eligible = board.filter((e) => e.eligible)
  const line = eligible[topN - 1]
  if (!line) return eligible.map((e) => e.address) // smaller field than the cut
  return eligible.filter((e) => e.xp >= line.xp).map((e) => e.address)
}

/**
 * The qualifier set for an event, as a lowercase address set.
 *
 * Written once when the source event's board freezes. Self-healing on read: a
 * missing set is rebuilt from the frozen board, and a missing frozen board is
 * rebuilt from chain. Returns null when it genuinely cannot be determined —
 * callers must treat that as "gate unavailable", never as "nobody qualified".
 */
async function getQualifierSet(sourceId: string): Promise<Set<string> | null> {
  const redis = getRedis()

  const cached = await redis.smembers(K.qualifiers(sourceId))
  if (cached && cached.length > 0) return new Set(cached.map((a) => String(a).toLowerCase()))

  const source = getSeasonById(sourceId)
  if (!source || !source.qualifyTopN) return null
  if (Date.now() < source.endsAt) return null // still running — no set yet

  let final = await redis.get<TournamentBoard>(K.final(sourceId))
  if (!final) {
    // A strict freeze throws rather than write a board off unreliable reads.
    // That must not take the live board down with it — fall through to the
    // "gate unavailable" path below, which the caller already handles.
    try {
      await freezeSeason(source)
    } catch (err) {
      console.error(`[tournament] freeze of gate source '${sourceId}' failed:`, (err as Error)?.message)
    }
    final = await redis.get<TournamentBoard>(K.final(sourceId))
  }
  if (!final?.board?.length) return null

  const addresses = qualifiersFromBoard(final.board, source.qualifyTopN)
  if (addresses.length === 0) return null
  await redis.sadd(K.qualifiers(sourceId), addresses[0], ...addresses.slice(1))
  return new Set(addresses)
}

async function buildBoard(win: TournamentWindow, strict = false): Promise<TournamentBoard> {
  const seed = await getSeedRatings(win)
  const games = await resolveAliases(await collectWindowGames(win.startsAt, win.endsAt, strict))
  const scored = scoreWindow(games, seed)
  let board = scored.board

  // Closed field: only players who came through the named Qualifiers score.
  // If the gate can't be resolved the event runs open rather than empty — a
  // Grand Prix with the wrong field is recoverable, one with no field at all
  // is a dead week that silently looks like nobody played.
  if (win.qualifiersFrom) {
    const allowed = await getQualifierSet(win.qualifiersFrom)
    if (allowed) {
      board = board.filter((e) => allowed.has(e.address.toLowerCase()))
      board.forEach((e, i) => (e.rank = i + 1))
    } else {
      console.error(
        `[tournament] ${win.id}: qualifier set '${win.qualifiersFrom}' unavailable — scoring an OPEN field`,
      )
    }
  }

  return {
    window: win,
    board,
    winners: prizeWinners(board, win),
    frozen: false,
    excluded: scored.excluded,
  }
}

/**
 * Everything a payout depends on, as one comparable string — used to check two
 * builds of the same closed window against each other before freezing.
 */
function boardFingerprint(b: TournamentBoard): string {
  const rows = b.board
    .map((e) => [e.rank, e.address, e.xp, e.wins, e.losses, e.draws, e.games, e.distinctOpponents, e.eligible].join(':'))
    .join('|')
  const winners = b.winners.map((w) => `${w.place}:${w.address}:${w.amount}`).join('|')
  // detectFeeders builds its set from game order, so sort before comparing.
  const excluded = [...(b.excluded ?? [])].sort().join('|')
  return `${rows}#${winners}#${excluded}`
}

/**
 * Freeze the most recently concluded season's final board, once. Runs
 * opportunistically on any board read — including during a rest week, which is
 * exactly when a season has just ended. The frozen board is the source of
 * truth for payout.
 */
async function freezeConcludedIfNeeded(): Promise<void> {
  const prev = getLatestConcludedSeason()
  if (prev) await freezeSeason(prev)
}

/**
 * Freeze one specific concluded event, once, and derive its qualifier set if it
 * gates a later one.
 *
 * Takes an explicit window rather than reaching for "the latest concluded":
 * getQualifierSet needs to freeze the *source* Qualifiers, which stops being
 * the latest concluded event the moment the Grand Prix it feeds ends. Resolving
 * "latest" in here would both miss that event and recurse — a Grand Prix freeze
 * would ask for its gate, which would ask to freeze the latest concluded, which
 * is that same Grand Prix.
 *
 * The board is built **twice, strictly, and only written if the two agree**.
 * The window is already closed by the time we get here, so no new game can
 * enter it — two honest reads of a closed window must produce the same board,
 * and any disagreement means the chain reads themselves are unreliable right
 * now. Bailing is safe and self-healing: the freeze simply retries on the next
 * board read. Writing is not, because K.final is written once and never
 * revisited, so a board frozen off a bad read decides payout permanently.
 */
async function freezeSeason(win: TournamentWindow): Promise<void> {
  const redis = getRedis()
  if (await redis.exists(K.final(win.id))) return
  // Only freezable if the event was actually seeded while it was live.
  const seeded = await redis.exists(K.seed(win.id))
  if (!seeded) return

  const result = await buildBoard(win, true)
  const confirm = await buildBoard(win, true)
  if (boardFingerprint(result) !== boardFingerprint(confirm)) {
    console.error(
      `[tournament] ${win.id}: freeze aborted — two strict builds of a closed window disagreed; retrying on next read`,
    )
    return
  }

  await redis.set(K.final(win.id), { ...result, frozen: true })

  // Lock the advancing field in at the same moment the board becomes final.
  if (win.qualifyTopN) {
    const addresses = qualifiersFromBoard(result.board, win.qualifyTopN)
    if (addresses.length > 0) await redis.sadd(K.qualifiers(win.id), addresses[0], ...addresses.slice(1))
  }
}

/** The live season's board + prize standings. Cached briefly. */
export async function getCurrentTournament(): Promise<TournamentBoard> {
  const win = getActiveSeason()
  const redis = getRedis()

  // Rest week (or before S1 ever opened): nothing is running. Still take the
  // chance to lock in the season that just ended.
  if (!win) {
    await freezeConcludedIfNeeded().catch((e) =>
      console.error('[tournament] freeze concluded failed:', (e as Error)?.message),
    )

    // Show the just-ended season's frozen board (static winners page) in place
    // of the empty idle state, until the next season opens over it.
    const prev = getLatestConcludedSeason()
    if (prev) {
      const final = await redis.get<TournamentBoard>(K.final(prev.id))
      if (final) return { ...final, window: prev, next: getNextSeason() }
    }

    return { window: null, board: [], winners: [], frozen: false, next: getNextSeason() }
  }

  const cached = await redis.get<TournamentBoard>(K.board(win.id))
  if (cached) return { ...cached, cached: true }

  // Lock in the previous season if it just ended (non-blocking best-effort).
  freezeConcludedIfNeeded().catch((e) =>
    console.error('[tournament] freeze concluded failed:', (e as Error)?.message),
  )

  const result = await buildBoard(win)
  await redis.set(K.board(win.id), result, { ex: BOARD_TTL })
  return result
}

/**
 * A rolling XP board over the last `windowMs` — the engine driving the
 * leaderboard's 24H and 1W views.
 *
 * These windows can't rank by ELO the way the all-time board does: the contract
 * stores one cumulative rating per player and no per-game history, so there is
 * no such thing as "your rating over the last 24 hours". XP is the only metric
 * that's actually windowable, and it already carries opponent strength.
 *
 * Unlike a season, ratings here are read live rather than snapshotted — a
 * rolling view has no opening moment to freeze against, and nothing is paid out
 * on it, so there's no incentive to game the weighting.
 */
export async function getRollingBoard(windowMs: number): Promise<BoardEntry[]> {
  const nowMs = Date.now()
  const ratings = await fetchCurrentRatings()
  const games = await resolveAliases(await collectWindowGames(nowMs - windowMs, nowMs))
  return scoreWindow(games, ratings).board
}

/** A concluded season's frozen final board, if one exists. */
export async function getFinalTournament(id: string): Promise<TournamentBoard | null> {
  return (await getRedis().get<TournamentBoard>(K.final(id))) ?? null
}
