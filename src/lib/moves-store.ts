import { Redis } from '@upstash/redis'

// Shared Redis client. Reads env vars at module load — if they're missing the
// client will throw on first use, which is the correct fail-loud behaviour.
let _redis: Redis | null = null

function key(chain: Chain, gameId: number): string {
  return `chess:moves:${chain}:${gameId}`
}

export type Chain = 'celo' | 'stacks'

export interface MoveRecord {
  san: string         // standard algebraic notation, e.g. "e4", "Nxe5", "O-O"
  player: string      // player wallet address (creator or opponent)
  moveNumber: number  // 1-indexed, monotonically increasing
  ts: number          // unix ms when the relay accepted it
}

const TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days — long enough for any reasonable game

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

/** Append a move to a game's history. Returns the new move count. */
export async function appendMove(chain: Chain, gameId: number, move: MoveRecord): Promise<number> {
  const redis = getRedis()
  const k = key(chain, gameId)
  const newLen = await redis.rpush(k, JSON.stringify(move))
  // Reset TTL on every write so an active game never expires mid-play
  await redis.expire(k, TTL_SECONDS)
  return newLen
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
