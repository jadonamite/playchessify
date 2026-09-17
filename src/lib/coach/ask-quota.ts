import { Redis } from '@upstash/redis'

/**
 * Asks per game. Server-side and keyed to (game, asker) — a browser counter
 * is a suggestion. Free for now; the charge will go inside `consume`.
 */

export const ASKS_PER_GAME = Number(process.env.COACH_ASKS_PER_GAME ?? 10)

/** Long enough to outlive any real game, short enough that keys do not pile up. */
const TTL_SECONDS = 24 * 60 * 60

let _redis: Redis | null = null
function getRedis(): Redis | null {
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  _redis = new Redis({ url, token })
  return _redis
}

/** `chess:asks:<game>:<asker>` — one counter per player per game. */
function key(gameKey: string, asker: string): string {
  return `chess:asks:${gameKey.toLowerCase()}:${asker.toLowerCase()}`
}

export interface QuotaState {
  used: number
  limit: number
  remaining: number
}

/** Read the meter without moving it. For rendering "7 left" before a click. */
export async function peek(gameKey: string, asker: string): Promise<QuotaState> {
  const redis = getRedis()
  const limit = ASKS_PER_GAME
  if (!redis) return { used: 0, limit, remaining: limit }
  const used = Number((await redis.get<number | string>(key(gameKey, asker))) ?? 0)
  return { used, limit, remaining: Math.max(0, limit - used) }
}

/** Increment then check, so two concurrent asks can't both spend the last one. */
export async function consume(gameKey: string, asker: string): Promise<{ ok: boolean } & QuotaState> {
  const redis = getRedis()
  const limit = ASKS_PER_GAME

  // No Redis means no meter — refuse rather than hand out unlimited asks.
  if (!redis) return { ok: false, used: limit, limit, remaining: 0 }

  const k = key(gameKey, asker)
  const used = await redis.incr(k)
  if (used === 1) await redis.expire(k, TTL_SECONDS)

  if (used > limit) {
    await redis.decr(k) // put it back so the count stays truthful
    return { ok: false, used: limit, limit, remaining: 0 }
  }
  return { ok: true, used, limit, remaining: limit - used }
}

/** Give back an ask whose analysis never produced anything. */
export async function refund(gameKey: string, asker: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  const k = key(gameKey, asker)
  const after = await redis.decr(k)
  if (after < 0) await redis.set(k, 0)
}
