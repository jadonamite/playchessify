// The coach's own money.
//
// Today a coaching request is a feature: the server calls a model on a platform
// key and the cost is invisible. An agent with economic agency is different —
// it holds a balance, spends it per request, and stops when it runs out. That
// difference is the whole point, so the ledger is the first thing to exist:
// nothing can be spent that isn't accounted for here.
//
// Amounts are integer micro-units of the settlement stablecoin (6 decimals),
// never floats — a budget that drifts by rounding is not a budget.
import { Redis } from '@upstash/redis'

export const BUDGET_DECIMALS = 6
const MICRO = 1_000_000

let _redis: Redis | null = null
function getRedis(): Redis | null {
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  _redis = new Redis({ url, token })
  return _redis
}

const K = {
  /** Remaining balance, in micro-units. */
  balance: (coach: string) => `chess:coach:budget:${coach.toLowerCase()}`,
  /** Rolling spend log, newest first — what the player sees. */
  ledger: (coach: string) => `chess:coach:ledger:${coach.toLowerCase()}`,
}

const LEDGER_MAX = 50

export interface SpendEntry {
  ts: number
  /** Micro-units actually settled. */
  amount: number
  /** What it bought — the endpoint, not the prompt. */
  endpoint: string
  /** x402 settlement reference when the facilitator returned one. */
  ref?: string
}

export interface CoachBudget {
  coach: string
  /** Remaining balance in micro-units. */
  balance: number
  /** Same, as a human-readable decimal string. */
  display: string
  recent: SpendEntry[]
}

export function toMicro(amount: number): number {
  return Math.round(amount * MICRO)
}

export function fromMicro(micro: number): string {
  return (micro / MICRO).toFixed(BUDGET_DECIMALS).replace(/0+$/, '').replace(/\.$/, '')
}

export async function getBudget(coach: string): Promise<CoachBudget> {
  const redis = getRedis()
  if (!redis) return { coach, balance: 0, display: '0', recent: [] }

  const [raw, recent] = await Promise.all([
    redis.get<number | string>(K.balance(coach)),
    redis.lrange<SpendEntry>(K.ledger(coach), 0, LEDGER_MAX - 1),
  ])
  const balance = Number(raw ?? 0)
  return { coach, balance, display: fromMicro(balance), recent: recent ?? [] }
}

/** Top the coach up. Returns the new balance in micro-units. */
export async function credit(coach: string, micro: number): Promise<number> {
  const redis = getRedis()
  if (!redis) throw new Error('[coach/budget] no redis')
  if (!Number.isInteger(micro) || micro <= 0) throw new Error('[coach/budget] credit must be a positive integer')
  return await redis.incrby(K.balance(coach), micro)
}

/**
 * Reserve `micro` before spending it.
 *
 * Decrement-then-check, not check-then-decrement: two concurrent analyses must
 * not both see the last cent and both spend it. A reservation that overdraws is
 * rolled back and refused.
 */
export async function reserve(coach: string, micro: number): Promise<boolean> {
  const redis = getRedis()
  if (!redis) return false
  if (!Number.isInteger(micro) || micro <= 0) return false

  const after = await redis.decrby(K.balance(coach), micro)
  if (after < 0) {
    await redis.incrby(K.balance(coach), micro) // put it back
    return false
  }
  return true
}

/** Give back a reservation whose request never settled. */
export async function release(coach: string, micro: number): Promise<void> {
  const redis = getRedis()
  if (!redis || !Number.isInteger(micro) || micro <= 0) return
  await redis.incrby(K.balance(coach), micro)
}

/** Record a settled spend. Call only after the payment actually went through. */
export async function recordSpend(coach: string, entry: SpendEntry): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  await redis.lpush(K.ledger(coach), entry)
  await redis.ltrim(K.ledger(coach), 0, LEDGER_MAX - 1)
}
