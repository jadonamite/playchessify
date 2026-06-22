import type { ChessProfile } from '@/types/profile'
import { Redis } from '@upstash/redis'

let _redis: Redis | null = null

function getRedis(): Redis {
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('[profile-store] Missing Upstash env vars')
  _redis = new Redis({ url, token })
  return _redis
}

// ── Key builders ─────────────────────────────────────────────────────────────

const K = {
  addr:      (a: string) => `chess:profile:addr:${a.toLowerCase()}`,
  name:      (n: string) => `chess:profile:name:${n.toLowerCase()}`,
  namelock:  (a: string) => `chess:profile:namelock:${a.toLowerCase()}`,
  total:     ()          => `chess:profile:total`,
  recent:    ()          => `chess:profile:recent`,
  rl:        (a: string, action: string) => `chess:profile:rl:${action}:${a.toLowerCase()}`,
}

// ── Reserved / blocked names ──────────────────────────────────────────────────

const RESERVED = new Set([
  'admin','system','chessify','protocol','null','undefined','root',
  'api','app','www','support','help','test','dev','prod','chess',
  'king','queen','rook','bishop','knight','pawn','checkmate',
  'moderator','official','staff','bot','relay','contract','deployer',
])

const USERNAME_RE = /^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/

export function validateUsername(raw: string): { ok: boolean; reason?: string } {
  const name = raw.toLowerCase().trim()
  if (name.length < 3 || name.length > 20)
    return { ok: false, reason: 'Username must be 3–20 characters' }
  if (!USERNAME_RE.test(name))
    return { ok: false, reason: 'Only lowercase letters, numbers, and hyphens. No leading/trailing hyphens.' }
  if (name.includes('--'))
    return { ok: false, reason: 'No consecutive hyphens' }
  if (RESERVED.has(name))
    return { ok: false, reason: 'That name is reserved' }
  return { ok: true }
}

// ── Rate limiting (simple Redis counter) ─────────────────────────────────────

export async function checkRateLimit(
  address: string,
  action: 'claim' | 'update',
  limit: number,
  ttlSeconds: number,
): Promise<boolean> {
  const redis = getRedis()
  const key = K.rl(address, action)
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, ttlSeconds)
  return count <= limit
}

// ── Profile CRUD ──────────────────────────────────────────────────────────────

export async function getProfileByAddress(address: string): Promise<ChessProfile | null> {
  const redis = getRedis()
  const raw = await redis.get(K.addr(address))
  if (!raw) return null
  return (typeof raw === 'string' ? JSON.parse(raw) : raw) as ChessProfile
}

export async function getProfileByUsername(username: string): Promise<ChessProfile | null> {
  const redis = getRedis()
  const address = await redis.get(K.name(username.toLowerCase()))
  if (!address) return null
  return getProfileByAddress(address as string)
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const redis = getRedis()
  const existing = await redis.get(K.name(username.toLowerCase()))
  return !existing
}

export async function claimProfile(profile: ChessProfile): Promise<{ ok: boolean; reason?: string }> {
  const redis = getRedis()
  const name = profile.username.toLowerCase()

  // Atomic name reservation — SETNX: only succeeds if key doesn't exist
  const reserved = await redis.setnx(K.name(name), profile.address.toLowerCase())
  if (!reserved) return { ok: false, reason: 'Username already taken' }

  // Increment total — determine OG status
  const total = await redis.incr(K.total())
  const finalProfile: ChessProfile = { ...profile, og: total <= 100 }

  await redis.set(K.addr(profile.address.toLowerCase()), JSON.stringify(finalProfile))

  // Add to recent list (cap at 50)
  await redis.lpush(K.recent(), profile.address.toLowerCase())
  await redis.ltrim(K.recent(), 0, 49)

  return { ok: true }
}

export async function updateProfile(
  address: string,
  updates: Partial<Pick<ChessProfile, 'username' | 'displayName' | 'bio'>>,
): Promise<{ ok: boolean; reason?: string }> {
  const redis = getRedis()
  const addr = address.toLowerCase()
  const existing = await getProfileByAddress(addr)
  if (!existing) return { ok: false, reason: 'Profile not found' }

  const now = Date.now()
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

  // Handle username change
  if (updates.username && updates.username.toLowerCase() !== existing.username.toLowerCase()) {
    const sinceLastChange = now - (existing.usernameChangedAt ?? existing.createdAt)
    if (sinceLastChange < THIRTY_DAYS) {
      const daysLeft = Math.ceil((THIRTY_DAYS - sinceLastChange) / (24 * 60 * 60 * 1000))
      return { ok: false, reason: `Username can only be changed once every 30 days. ${daysLeft} day(s) remaining.` }
    }

    const newName = updates.username.toLowerCase()

    // Atomically reserve new name
    const reserved = await redis.setnx(K.name(newName), addr)
    if (!reserved) return { ok: false, reason: 'Username already taken' }

    // Release old name
    await redis.del(K.name(existing.username.toLowerCase()))

    existing.username = newName
    existing.usernameChangedAt = now
  }

  const updated: ChessProfile = {
    ...existing,
    displayName: updates.displayName ?? existing.displayName,
    bio: updates.bio ?? existing.bio,
    updatedAt: now,
  }

  await redis.set(K.addr(addr), JSON.stringify(updated))
  return { ok: true }
}

export async function getBatchProfiles(
  addresses: string[],
): Promise<Record<string, ChessProfile | null>> {
  if (addresses.length === 0) return {}
  const redis = getRedis()
  const keys = addresses.map((a) => K.addr(a.toLowerCase()))
  const results = await redis.mget<(ChessProfile | string | null)[]>(...keys)
  const out: Record<string, ChessProfile | null> = {}
  addresses.forEach((addr, i) => {
    const raw = results[i]
    if (!raw) { out[addr.toLowerCase()] = null; return }
    out[addr.toLowerCase()] = typeof raw === 'string' ? JSON.parse(raw) : raw
  })
  return out
}

export async function getRecentProfiles(limit = 10): Promise<ChessProfile[]> {
  const redis = getRedis()
  const addresses = await redis.lrange(K.recent(), 0, limit - 1)
  if (!addresses.length) return []
  const batch = await getBatchProfiles(addresses as string[])
  return (addresses as string[]).map((a) => batch[a.toLowerCase()]).filter(Boolean) as ChessProfile[]
}
