import { Redis } from '@upstash/redis'
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
  san: string // standard algebraic notation, e.g. "e4", "Nxe5", "O-O"
  player: string // player wallet address (creator or opponent) — the on-chain identity
  moveNumber: number // 1-indexed, monotonically increasing
  ts: number // unix ms when the relay accepted it
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
/** Append a move to a game's history. Returns the new move count. */
export async function appendMove(chain: Chain, gameId: number, move: MoveRecord): Promise<number> {
  const redis = getRedis()
  const k = key(chain, gameId)
  const newLen = await redis.rpush(k, JSON.stringify(move))
  // Reset TTL on every write so an active game never expires mid-play
  await redis.expire(k, TTL_SECONDS)
  return newLen
}
function parseMoveRecord(entry: string | object): MoveRecord {
  if (typeof entry === 'string') return JSON.parse(entry) as MoveRecord
  return entry as MoveRecord
}
/** Fetch all moves for a game in submission order. */
export async function getMoves(chain: Chain, gameId: number): Promise<MoveRecord[]> {
  const redis = getRedis()
  const raw = await redis.lrange(key(chain, gameId), 0, -1)
  return raw.map(parseMoveRecord)
}
