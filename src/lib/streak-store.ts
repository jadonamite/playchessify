import { Redis } from '@upstash/redis'

/**
 * Daily activity streaks — deliberately decoupled from the profile store so a
 * wallet that plays (bots, multiplayer, puzzles) tracks a streak even before it
 * has claimed a username. Day boundaries are UTC.
 *
 * The whole read-modify-write runs inside a single Redis Lua script, so two
 * games settling for the same player in the same instant can never
 * double-increment or clobber each other — atomic by construction, no lock.
 */

let _redis: Redis | null = null
function getRedis(): Redis {
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('[streak-store] Missing Upstash env vars')
  _redis = new Redis({ url, token })
  return _redis
}

const K = {
  streak: (a: string) => `chess:streak:${a.toLowerCase()}`,
  rl:     (a: string) => `chess:streak:rl:${a.toLowerCase()}`,
}

/** Sources that can earn a streak day. Multiplayer is credited server-side from
 *  settlement; bots and puzzles come through the signed client endpoint. */
export type StreakSource = 'multiplayer' | 'bot' | 'puzzle'

export interface StreakData {
  /** Effective current streak — 0 if the last play was before yesterday (broken). */
  current: number
  /** Longest streak ever reached. */
  longest: number
  /** UTC date (YYYY-MM-DD) of the last counted play, or '' if never. */
  lastPlayedDate: string
  /** True when the last counted play was today (UTC). */
  playedToday: boolean
}

export interface RecordResult extends StreakData {
  /** True when this call advanced or reset the streak (i.e. first play of the day). */
  incremented: boolean
}

/** Stored hash shape (raw current is the literal counter; reads derive the effective value). */
interface StoredStreak {
  current: number
  longest: number
  lastPlayedDate: string
}

// ── date helpers (UTC) ────────────────────────────────────────────────────────

/** UTC calendar day as YYYY-MM-DD. */
export function utcDateStr(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10)
}

function utcYesterdayStr(d: Date = new Date()): string {
  return new Date(d.getTime() - 86_400_000).toISOString().slice(0, 10)
}

// ── atomic update ─────────────────────────────────────────────────────────────

// KEYS[1] = streak hash key · ARGV[1] = today · ARGV[2] = yesterday
// Stored as a hash (fields: current, longest, last) so no cjson is needed.
// Returns { current, longest, incremented } as a 3-element array.
const RECORD_LUA = `
local current = tonumber(redis.call('HGET', KEYS[1], 'current')) or 0
local longest = tonumber(redis.call('HGET', KEYS[1], 'longest')) or 0
local last = redis.call('HGET', KEYS[1], 'last') or ''
local incremented = 0
if last == ARGV[1] then
  -- already counted today: no-op
elseif last == ARGV[2] then
  current = current + 1
  incremented = 1
else
  current = 1
  incremented = 1
end
if current > longest then longest = current end
redis.call('HSET', KEYS[1], 'current', current, 'longest', longest, 'last', ARGV[1])
return {current, longest, incremented}
`

/**
 * Record a counted play day for `address`. Idempotent within a UTC day — the
 * first play advances/resets the streak; subsequent plays the same day are
 * no-ops. Safe to call concurrently (atomic Lua).
 */
export async function recordPlayDay(address: string, now: Date = new Date()): Promise<RecordResult> {
  const today = utcDateStr(now)
  const yesterday = utcYesterdayStr(now)
  const res = (await getRedis().eval(
    RECORD_LUA,
    [K.streak(address)],
    [today, yesterday],
  )) as [number, number, number]

  const [current, longest, incremented] = res
  return {
    current,
    longest,
    lastPlayedDate: today,
    playedToday: true,
    incremented: incremented === 1,
  }
}

// ── reads ─────────────────────────────────────────────────────────────────────

function deriveStreak(stored: StoredStreak | null, now: Date = new Date()): StreakData {
  if (!stored || !stored.lastPlayedDate) {
    return { current: 0, longest: stored?.longest ?? 0, lastPlayedDate: '', playedToday: false }
  }
  const today = utcDateStr(now)
  const yesterday = utcYesterdayStr(now)
  // A streak is only still "alive" if the last play was today or yesterday.
  const alive = stored.lastPlayedDate === today || stored.lastPlayedDate === yesterday
  return {
    current: alive ? stored.current : 0,
    longest: stored.longest,
    lastPlayedDate: stored.lastPlayedDate,
    playedToday: stored.lastPlayedDate === today,
  }
}

export async function getStreak(address: string): Promise<StreakData> {
  const h = await getRedis().hgetall<Record<string, string | number>>(K.streak(address))
  const stored: StoredStreak | null = h
    ? {
        current: Number(h.current) || 0,
        longest: Number(h.longest) || 0,
        lastPlayedDate: typeof h.last === 'string' ? h.last : String(h.last ?? ''),
      }
    : null
  return deriveStreak(stored)
}

// ── light spam guard for the signed client endpoint ───────────────────────────

/** Allow `limit` streak pings per `ttlSeconds` window. recordPlayDay is already
 *  idempotent per day, so this only blunts abusive call volume. */
export async function checkStreakRateLimit(address: string, limit = 30, ttlSeconds = 60): Promise<boolean> {
  const redis = getRedis()
  const key = K.rl(address)
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, ttlSeconds)
  return count <= limit
}
