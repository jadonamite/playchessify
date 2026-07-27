import { Redis } from '@upstash/redis'
import type { Abi } from 'viem'
import { getMoves, type Chain } from '@/lib/moves-store'
import {
  getPublicClient,
  closeStaleOnChain,
  voidOnChain,
  GameStatus,
  GAME_ADDRESS,
} from '@/lib/celo-server'
import { CHESS_GAME_ABI } from '@/config/abis'

const LOG_PREFIX = '[lifecycle-sweep]'

// ─────────────────────────────────────────────────────────────────────────────
// Lobby/no-show sweep. The settlement worker only sees games with at least one
// relayed move (registration happens on the first move POST), so the two v2
// lifecycle rules — "a lobby expires after 10 minutes" and "a joined game where
// nobody ever moved gets voided" — need their own on-chain discovery. A cursor
// tracks the highest gameId ever scanned; games last seen as Waiting or as
// Active-without-moves stay in a small "open" watch set and are re-checked each
// run until they resolve.
//
// Gas discipline: only *wagered* games are closed/voided on-chain — that's where
// escrow is stuck. Free stale lobbies are filtered client-side via canJoin() and
// cost nothing to leave behind.
// ─────────────────────────────────────────────────────────────────────────────

const K = {
  cursor: 'chess:v2:sweep:cursor',
  open: (chain: Chain) => `chess:v2:sweep:open:${chain}`,
}

// Mirror the contract constants (JOIN_WINDOW / VOID_MIN_IDLE = 10 min), plus a
// grace so we never race an in-flight join/move and burn gas on a revert.
const JOIN_WINDOW_S = 600
const VOID_MIN_IDLE_S = 600
const GRACE_S = 60
const SCAN_CHUNK = 200

let _redis: Redis | null = null
function getRedis(): Redis {
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error(`${LOG_PREFIX} Upstash env not configured`)
  _redis = new Redis({ url, token })
  return _redis
}

interface SweepReport {
  scannedNew: number
  watching: number
  closedStale: number[]
  voided: number[]
  failed: { gameId: number; reason: string }[]
}

interface RawGame {
  white: string
  black: string
  wager: bigint
  status: number
  createdAt: bigint
  joinedAt: bigint
}

async function readGames(ids: number[]): Promise<Map<number, RawGame>> {
  const pub = getPublicClient()
  const out = new Map<number, RawGame>()
  for (let i = 0; i < ids.length; i += SCAN_CHUNK) {
    const slice = ids.slice(i, i + SCAN_CHUNK)
    const results = await pub.multicall({
      contracts: slice.map((id) => ({
        address: GAME_ADDRESS,
        abi: CHESS_GAME_ABI as Abi,
        functionName: 'getGame',
        args: [BigInt(id)],
      })),
      allowFailure: true,
    })
    results.forEach((r, j) => {
      if (r.status === 'success') out.set(slice[j], r.result as unknown as RawGame)
    })
  }
  return out
}

/**
 * One sweep pass: fold newly created games into the watch set, then close
 * expired wagered lobbies and void wagered no-move games. Call after the
 * settlement sweep (shares the oracle's gas preflight).
 */
export async function sweepLifecycle(chain: Chain): Promise<SweepReport> {
  const redis = getRedis()
  const pub = getPublicClient()

  const nonce = Number((await pub.readContract({
    address: GAME_ADDRESS,
    abi: CHESS_GAME_ABI as Abi,
    functionName: 'gameNonce',
  })) as bigint)
  const lastId = nonce - 1

  const cursor = Number((await redis.get<number>(K.cursor)) ?? 0)
  const newIds: number[] = []
  for (let id = cursor + 1; id <= lastId; id++) newIds.push(id)

  const watched = ((await redis.smembers(K.open(chain))) as Array<string | number>)
    .map(Number)
    .filter(Number.isInteger)

  const candidates = [...new Set([...watched, ...newIds])]
  const report: SweepReport = {
    scannedNew: newIds.length,
    watching: 0,
    closedStale: [],
    voided: [],
    failed: [],
  }
  if (candidates.length === 0) return report

  const games = await readGames(candidates)
  const now = Math.floor(Date.now() / 1000)
  const keep: number[] = []
  const drop: number[] = []

  // Sequential on-chain actions to keep oracle nonces ordered.
  for (const id of candidates) {
    const g = games.get(id)
    if (!g) { drop.push(id); continue }
    const status = Number(g.status) as GameStatus
    const wagered = g.wager > 0n

    if (status === GameStatus.Waiting) {
      const expired = now - Number(g.createdAt) > JOIN_WINDOW_S + GRACE_S
      if (!expired) { keep.push(id); continue }
      if (!wagered) { drop.push(id); continue } // nothing locked — client hides it via canJoin
      try {
        await closeStaleOnChain(id)
        report.closedStale.push(id)
        drop.push(id)
      } catch (err) {
        report.failed.push({ gameId: id, reason: (err as Error)?.message ?? 'closeStale failed' })
        keep.push(id) // retry next run
      }
      continue
    }

    if (status === GameStatus.Active) {
      const moves = await getMoves(chain, id)
      if (moves.length > 0) { drop.push(id); continue } // settlement worker owns it now
      const idle = now - Number(g.joinedAt) > VOID_MIN_IDLE_S + GRACE_S
      if (!idle) { keep.push(id); continue }
      if (!wagered) { drop.push(id); continue } // no escrow at stake
      try {
        await voidOnChain(id)
        report.voided.push(id)
        drop.push(id)
      } catch (err) {
        report.failed.push({ gameId: id, reason: (err as Error)?.message ?? 'void failed' })
        keep.push(id)
      }
      continue
    }

    // Finished / Cancelled / Draw — resolved, stop watching.
    drop.push(id)
  }

  const pipe = redis.pipeline()
  if (keep.length > 0) pipe.sadd(K.open(chain), keep[0], ...keep.slice(1))
  if (drop.length > 0) pipe.srem(K.open(chain), drop[0], ...drop.slice(1))
  pipe.set(K.cursor, Math.max(cursor, lastId))
  await pipe.exec()

  report.watching = keep.length
  if (report.failed.length > 0) {
    console.error(`${LOG_PREFIX} actions need attention`, { failed: report.failed })
  }
  return report
}
