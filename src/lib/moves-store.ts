import { Redis } from '@upstash/redis'

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
  san: string
  player: string
  moveNumber: number
  ts: number
  sig?: string
  signer?: string
}

const TTL_SECONDS = 60 * 60 * 24 * 30

function getKeyOrActiveKey(chain: Chain, gameId?: number, isActive?: boolean): string {
  if (isActive) return `chess:active:${chain}`
  if (gameId === undefined) throw new Error('gameId is required')
  return `chess:moves:${chain}:${gameId}`
}

/** Register a game as live so the settlement worker can sweep it. Idempotent. */
export async function registerActiveGame(chain: Chain, gameId: number): Promise<void> {
  await getRedis().sadd(getKeyOrActiveKey(chain, undefined, true), gameId)
}

/** Remove a game from the active set once it has been settled / is no longer Active. */
export async function unregisterActiveGame(chain: Chain, gameId: number): Promise<void> {
  await getRedis().srem(getKeyOrActiveKey(chain, undefined, true), gameId)
}

/** All game IDs the worker should consider for settlement. */
export async function getActiveGameIds(chain: Chain): Promise<number[]> {
  const raw = await getRedis().smembers(getKeyOrActiveKey(chain, undefined, true))
  return raw.map((v) => Number(v)).filter((n) => Number.isInteger(n))
}

/** Append a move to a game's history. Returns the new move count. */
export async function appendMove(chain: Chain, gameId: number, move: MoveRecord): Promise<number> {
  const redis = getRedis()
  const k = getKeyOrActiveKey(chain, gameId)
  const newLen = await redis.rpush(k, JSON.stringify(move))
  await redis.expire(k, TTL_SECONDS)
  return newLen
}

/** Fetch all moves for a game in submission order. */
export async function getMoves(chain: Chain, gameId: number): Promise<MoveRecord[]> {
  const redis = getRedis()
  const raw = await redis.lrange(getKeyOrActiveKey(chain, gameId), 0, -1)
  return raw.map((entry) => {
    if (typeof entry === 'string') return JSON.parse(entry) as MoveRecord
    return entry as MoveRecord
  })
}