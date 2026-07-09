import { Redis } from '@upstash/redis'
import { Chess } from 'chess.js'

// Shared Redis client. Reads env vars at module load — if they're missing the
// client will throw on first use, which is the correct fail-loud behaviour.
let _redis: Redis | null = null

function getRedis(): Redis {
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    throw new Error('[moves-store] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set')
  }
  _redis = new Redis({ url, token })
  return _redis
}

export type Chain = 'celo'

export interface MoveRecord {
  san: string         // standard algebraic notation, e.g. "e4", "Nxe5", "O-O"
  player: string      // player wallet address (creator or opponent) — the on-chain identity
  moveNumber: number  // 1-indexed, monotonically increasing
  ts: number          // unix ms when the relay accepted it
  // Optional wallet signature over canonicalMoveMessage(...). Present for wallets
  // that can sign (Tier A smart accounts, Tier C EOAs); absent for MiniPay, which
  // cannot sign messages — those moves rely on the relay's participant/turn binding.
  sig?: string
  signer?: string
}

const TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days — long enough for any reasonable game

function key(chain: Chain, gameId: number): string {
  return `chess:moves:${chain}:${gameId}`
}

function activeKey(chain: Chain): string {
  return `chess:active:${chain}`
}

/** Register a game as live so the settlement worker can sweep it. Idempotent. */
export async function registerActiveGame(chain: Chain, gameId: number): Promise<void> {
  await getRedis().sadd(activeKey(chain), gameId)
}

/** Remove a game from the active set once it has been settled / is no longer Active. */
export async function unregisterActiveGame(chain: Chain, gameId: number): Promise<void> {
  await getRedis().srem(activeKey(chain), gameId)
}

/** All game IDs the worker should consider for settlement. */
export async function getActiveGameIds(chain: Chain): Promise<number[]> {
  const raw = await getRedis().smembers(activeKey(chain))
  return raw.map((v) => Number(v)).filter((n) => Number.isInteger(n))
}

// Atomically append only if the history is exactly `expectedLen` long — i.e.
// this move lands at slot `expectedLen`. Without this, the relay's
// check-then-RPUSH had a TOCTOU race: two of the side-to-move's POSTs could both
// read length N, both validate as legal from that position, and both push,
// leaving move N+2 illegal in sequence and corrupting the game history. The
// LLEN check + RPUSH run in one Redis round-trip, so exactly one writer wins.
//
// KEYS[1]=list · ARGV[1]=JSON move · ARGV[2]=expectedLen · ARGV[3]=ttl
// Returns the new length, or -1 if another writer already filled the slot.
const APPEND_LUA = `
local len = redis.call('LLEN', KEYS[1])
if len ~= tonumber(ARGV[2]) then
  return -1
end
redis.call('RPUSH', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
return len + 1
`

/**
 * Append a move at slot `expectedLen` (the history length the caller validated
 * against). Returns the new move count, or `null` if another move already
 * landed in that slot — the caller should treat that as a conflict and resync.
 */
export async function appendMove(
  chain: Chain,
  gameId: number,
  move: MoveRecord,
  expectedLen: number,
): Promise<number | null> {
  const res = (await getRedis().eval(
    APPEND_LUA,
    [key(chain, gameId)],
    [JSON.stringify(move), String(expectedLen), String(TTL_SECONDS)],
  )) as number
  return res < 0 ? null : res
}

/** Fetch all moves for a game in submission order. */
export async function getMoves(chain: Chain, gameId: number): Promise<MoveRecord[]> {
  const redis = getRedis()
  const raw = await redis.lrange(key(chain, gameId), 0, -1)
  return raw.map((entry) => {
    // Upstash returns objects when values are JSON-parseable; strings otherwise.
    if (typeof entry === 'string') return JSON.parse(entry) as MoveRecord
    return entry as MoveRecord
  })
}

/** Length of the longest prefix of `moves` that replays legally. A healthy
 *  history returns `moves.length`; a corrupt one returns the index of the first
 *  move that doesn't fit the position (chess.js v1 throws on an illegal move). */
function longestLegalPrefix(moves: MoveRecord[]): number {
  const board = new Chess()
  for (let i = 0; i < moves.length; i++) {
    try {
      board.move(moves[i].san)
    } catch {
      return i
    }
  }
  return moves.length
}

/**
 * Repair a history corrupted by the old append race: trim it to the longest
 * legal prefix, dropping any out-of-turn move(s) left by a double-write. The
 * kept prefix includes the move that actually landed first, so the surviving
 * game state is exactly what both clients agreed on up to the corruption.
 */
export async function repairGameHistory(
  chain: Chain,
  gameId: number,
): Promise<{ before: number; after: number; trimmed: number }> {
  const moves = await getMoves(chain, gameId)
  const keep = longestLegalPrefix(moves)
  if (keep < moves.length) {
    if (keep === 0) {
      await getRedis().del(key(chain, gameId))
    } else {
      await getRedis().ltrim(key(chain, gameId), 0, keep - 1)
    }
  }
  return { before: moves.length, after: keep, trimmed: moves.length - keep }
}
