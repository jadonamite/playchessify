import { Redis } from '@upstash/redis'
import { BOT_DAILY_HUMAN_CAP } from '@/config/bots'

// Redis state for the bot fleet: the per-human daily pairing cap, the set of
// games a bot is (or was) part of, and the scheduler tick lock. Same Upstash
// instance and `chess:v2` namespace as the rest of the relay state.

let _redis: Redis | null = null
function getRedis(): Redis {
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('[bots/state] Upstash env not configured')
  _redis = new Redis({ url, token })
  return _redis
}

function utcDay(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

const K = {
  cap: (addr: string) => `chess:v2:bots:cap:${addr.toLowerCase()}:${utcDay()}`,
  games: 'chess:v2:bots:games',
  counted: (gameId: number) => `chess:v2:bots:counted:${gameId}`,
  tickLock: 'chess:v2:bots:tick-lock',
}

/** Bot games this human has been paired into today (UTC). */
export async function humanBotGamesToday(address: string): Promise<number> {
  const n = await getRedis().get<number>(K.cap(address))
  return Number(n ?? 0)
}

/** Whether this human can still be paired with a bot today. */
export async function humanUnderBotCap(address: string): Promise<boolean> {
  return (await humanBotGamesToday(address)) < BOT_DAILY_HUMAN_CAP
}

/**
 * Count a human↔bot pairing once per game (idempotent via a per-game marker):
 * covers both a bot joining the human's lobby and the human joining a bot's.
 */
export async function countPairingOnce(gameId: number, humanAddress: string): Promise<void> {
  const redis = getRedis()
  const first = await redis.set(K.counted(gameId), 1, { nx: true, ex: 7 * 86400 })
  if (first === null) return // already counted
  const capKey = K.cap(humanAddress)
  await redis.incr(capKey)
  await redis.expire(capKey, 2 * 86400)
}

/** Track a game a bot participates in so the scheduler sweeps it. */
export async function registerBotGame(gameId: number): Promise<void> {
  await getRedis().sadd(K.games, gameId)
}

export async function unregisterBotGame(gameId: number): Promise<void> {
  await getRedis().srem(K.games, gameId)
}

export async function getBotGameIds(): Promise<number[]> {
  const raw = await getRedis().smembers(K.games)
  return raw.map(Number).filter(Number.isInteger)
}

/** Take the fleet tick lock for `seconds`; false means another tick is live. */
export async function acquireTickLock(seconds: number): Promise<boolean> {
  return (await getRedis().set(K.tickLock, Date.now(), { nx: true, ex: seconds })) !== null
}
