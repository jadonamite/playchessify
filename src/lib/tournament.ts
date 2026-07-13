import { Redis } from '@upstash/redis'
import type { Abi } from 'viem'
import { getPublicClient } from '@/lib/celo-server'
import { syncGameIndex, getIndexedPlayers } from '@/lib/game-index'
import { CELO_CONTRACTS } from '@/config/contracts'
import { CHESS_GAME_ABI } from '@/config/abis'
import {
  TOURNAMENT,
  getTournamentAt,
  previousWindow,
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
  eligible: boolean
  rank: number
}

export interface PrizeWinner {
  place: number
  address: string
  amount: number
}

export interface TournamentBoard {
  window: TournamentWindow
  board: BoardEntry[]
  winners: PrizeWinner[]
  frozen: boolean
  cached?: boolean
}

// ── seed ratings ─────────────────────────────────────────────────────────────

/**
 * Ratings snapshot for a season, captured once on first read after it opens.
 * Used only for opponent-strength weighting, never for the score itself.
 */
async function getSeedRatings(win: TournamentWindow): Promise<Record<string, number>> {
  const redis = getRedis()
  const existing = await redis.hgetall<Record<string, number>>(K.seed(win.id))
  if (existing && Object.keys(existing).length > 0) {
    // Upstash may hand back string values — coerce.
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(existing)) out[k] = Number(v)
    return out
  }

  await syncGameIndex()
  const addresses = await getIndexedPlayers()
  const seed: Record<string, number> = {}
  if (addresses.length === 0) return seed

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
    seed[addr.toLowerCase()] = rating || BASE_RATING
  })

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
 */
async function scanContractWindow(
  game: `0x${string}`,
  abi: Abi,
  toSec: (createdAt: number) => number,
  startMs: number,
  endMs: number,
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
    results.forEach((r, i) => {
      if (r.status !== 'success') return
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

    // Whole chunk predates the window — nothing older can qualify.
    if (chunkMaxSec > 0 && chunkMaxSec < startSec) break
  }
  return games
}

/** All settled games played within [startMs, endMs] — v2, plus the retired v1
 *  contract for windows that opened before the cutover. */
async function collectWindowGames(startMs: number, endMs: number): Promise<WindowGame[]> {
  const scans = [scanContractWindow(GAME, CHESS_GAME_ABI as Abi, (t) => t, startMs, endMs)]
  if (startMs < V2_CUTOVER_MS) {
    scans.push(getBlockToTimeMapper().then((toSec) => scanContractWindow(V1_GAME, V1_GAME_ABI as Abi, toSec, startMs, endMs)))
  }
  const games = (await Promise.all(scans)).flat()

  // Chronological order so daily diminishing counts games as they happened.
  games.sort((a, b) => a.playedAt - b.playedAt || a.id - b.id)
  return games
}

// ── scoring ──────────────────────────────────────────────────────────────────

const ZERO = '0x0000000000000000000000000000000000000000'

function scoreWindow(games: WindowGame[], seed: Record<string, number>): BoardEntry[] {
  const x = TOURNAMENT.xp
  const seedOf = (a: string) => seed[a] ?? BASE_RATING
  const clamp = (v: number) => Math.min(x.oppWeightMax, Math.max(x.oppWeightMin, v))

  interface Acc {
    xp: number
    wins: number
    losses: number
    draws: number
    games: number
    perDay: Record<number, number>
  }
  const acc: Record<string, Acc> = {}
  const get = (a: string): Acc =>
    (acc[a] ??= { xp: 0, wins: 0, losses: 0, draws: 0, games: 0, perDay: {} })

  const award = (player: string, opp: string, base: number, day: number) => {
    if (!player || player === ZERO) return
    const a = get(player)
    const weight = clamp(1 + (seedOf(opp) - seedOf(player)) / x.oppWeightDivisor)
    const n = (a.perDay[day] = (a.perDay[day] ?? 0) + 1)
    const dim = n <= x.softCapGames ? 1 : Math.pow(x.diminishingFactor, n - x.softCapGames)
    a.xp += base * weight * dim
    a.games += 1
  }

  for (const g of games) {
    const isDraw = g.status === STATUS_DRAW || g.result === RESULT_DRAW
    const settled = isDraw || g.status === STATUS_FINISHED
    if (!settled) continue
    if (!g.white || !g.black || g.white === ZERO || g.black === ZERO) continue
    const day = Math.floor(g.playedAt / 86400)

    if (isDraw) {
      award(g.white, g.black, x.draw, day)
      award(g.black, g.white, x.draw, day)
      get(g.white).draws += 1
      get(g.black).draws += 1
    } else {
      const winner = g.result === RESULT_WHITE_WINS ? g.white : g.black
      const loser = winner === g.white ? g.black : g.white
      award(winner, loser, x.win, day)
      award(loser, winner, x.loss, day)
      get(winner).wins += 1
      get(loser).losses += 1
    }
  }

  const board: BoardEntry[] = Object.entries(acc).map(([address, a]) => ({
    address,
    xp: Math.round(a.xp),
    wins: a.wins,
    losses: a.losses,
    draws: a.draws,
    games: a.games,
    eligible: a.games >= x.minGamesEligible,
    rank: 0,
  }))
  // Highest XP first; fewer games breaks ties (efficiency over volume).
  board.sort((p, q) => q.xp - p.xp || p.games - q.games)
  board.forEach((e, i) => (e.rank = i + 1))
  return board
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

async function buildBoard(win: TournamentWindow): Promise<TournamentBoard> {
  const seed = await getSeedRatings(win)
  const games = await collectWindowGames(win.startsAt, win.endsAt)
  const board = scoreWindow(games, seed)
  return { window: win, board, winners: prizeWinners(board, win), frozen: false }
}

/**
 * Freeze a season's final board the first time we notice it has ended. Runs
 * opportunistically when the *next* season is read, so each concluded season is
 * locked in exactly once — this frozen board is the source of truth for payout.
 */
async function freezePreviousIfNeeded(current: TournamentWindow): Promise<void> {
  const prev = previousWindow(current)
  if (!prev) return
  const redis = getRedis()
  if (await redis.exists(K.final(prev.id))) return
  // Only freezable if the season was actually seeded while it was live.
  const seeded = await redis.exists(K.seed(prev.id))
  if (!seeded) return
  const result = await buildBoard(prev)
  await redis.set(K.final(prev.id), { ...result, frozen: true })
}

/** The live season's board + prize standings. Cached briefly. */
export async function getCurrentTournament(): Promise<TournamentBoard> {
  const win = getTournamentAt()
  const redis = getRedis()

  if (win.status === 'upcoming') {
    return { window: win, board: [], winners: [], frozen: false }
  }

  const cached = await redis.get<TournamentBoard>(K.board(win.id))
  if (cached) return { ...cached, cached: true }

  // Lock in the previous season if it just ended (non-blocking best-effort).
  freezePreviousIfNeeded(win).catch((e) =>
    console.error('[tournament] freeze previous failed:', (e as Error)?.message),
  )

  const result = await buildBoard(win)
  await redis.set(K.board(win.id), result, { ex: BOARD_TTL })
  return result
}

/** A concluded season's frozen final board, if one exists. */
export async function getFinalTournament(id: string): Promise<TournamentBoard | null> {
  return (await getRedis().get<TournamentBoard>(K.final(id))) ?? null
}
