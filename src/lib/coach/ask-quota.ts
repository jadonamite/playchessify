import { Redis } from '@upstash/redis'

/**
 * How many opinions you may ask the coach for in one game.
 *
 * This is the meter the payment layer will eventually sit on top of. It lives
 * server-side and is keyed to the game and the asker, never to client state —
 * a counter in the browser is a suggestion, and the whole point of a cap is
 * that it holds against someone who does not want it to.
 *
 * Free this iteration. When asks become payable, the charge goes exactly here,
 * between `consume` returning ok and the analysis running, so switching from
 * free to paid is a change of policy and not a change of shape.
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

/**
 * Take one ask. Increment first, then check: two requests firing together must
 * not both read "9 used" and both be allowed through. An increment that went
 * past the limit is rolled back and refused.
 */
export async function consume(gameKey: string, asker: string): Promise<{ ok: boolean } & QuotaState> {
  const redis = getRedis()
  const limit = ASKS_PER_GAME

  // No Redis means no meter. Refuse rather than hand out unlimited asks — a
  // metered feature that silently stops being metered is worse than one that
  // is briefly unavailable.
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
