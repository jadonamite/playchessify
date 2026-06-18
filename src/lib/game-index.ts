import { Redis } from '@upstash/redis'
import type { Abi } from 'viem'
import { getPublicClient } from '@/lib/celo-server'
import { CELO_CONTRACTS } from '@/config/contracts'
import { CHESS_GAME_ABI } from '@/config/abis'

// ─────────────────────────────────────────────────────────────────────────────
// Off-chain game index (Upstash). Keeps a running, append-only index of which
// addresses have appeared in games and which gameIds each address played, so the
// leaderboard and history don't have to re-scan every game on the chain on each
// load. A cursor records the highest gameId already folded into the index; each
// sync only scans the delta (cursor+1 .. current gameNonce).
// ─────────────────────────────────────────────────────────────────────────────

const ZERO = '0x0000000000000000000000000000000000000000'
const GAME = CELO_CONTRACTS.game as `0x${string}`
const SCAN_CHUNK = 200

const K = {
  cursor: 'chess:idx:cursor',
  players: 'chess:idx:players',
  playerGames: (a: string) => `chess:idx:player:${a.toLowerCase()}`,
}

let _redis: Redis | null = null
function getRedis(): Redis {
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('[game-index] Upstash env not configured')
  _redis = new Redis({ url, token })
  return _redis
}

async function gameNonce(): Promise<number> {
  const n = (await getPublicClient().readContract({
    address: GAME,
    abi: CHESS_GAME_ABI as Abi,
    functionName: 'gameNonce',
  })) as bigint
  return Number(n)
}

/**
 * Fold any games created since the last sync into the index. Bounded by the
 * number of *new* games, not the total. Returns the current gameNonce.
 */
export async function syncGameIndex(): Promise<number> {
  const redis = getRedis()
  const cursor = Number((await redis.get<number>(K.cursor)) ?? -1)
  const nonce = await gameNonce()
  const lastGameId = nonce - 1
  if (lastGameId <= cursor) return nonce

  const pub = getPublicClient()
  for (let start = cursor + 1; start <= lastGameId; start += SCAN_CHUNK) {
    const end = Math.min(start + SCAN_CHUNK - 1, lastGameId)
    const ids = Array.from({ length: end - start + 1 }, (_, i) => BigInt(start + i))
    const results = await pub.multicall({
      contracts: ids.map((id) => ({
        address: GAME,
        abi: CHESS_GAME_ABI as Abi,
        functionName: 'getGame',
        args: [id],
      })),
      allowFailure: true,
    })

    const pipe = redis.pipeline()
    let queued = false
    results.forEach((r, i) => {
      if (r.status !== 'success') return
      const g = r.result as { white: string; black: string }
      const id = Number(ids[i])
      for (const raw of [g.white, g.black]) {
        const addr = (raw ?? '').toLowerCase()
        if (!addr || addr === ZERO || !addr.startsWith('0x')) continue
        pipe.sadd(K.players, addr)
        pipe.sadd(K.playerGames(addr), id)
        queued = true
      }
    })
    if (queued) await pipe.exec()
    // Advance the cursor per chunk so a mid-scan failure resumes, not restarts.
    await redis.set(K.cursor, end)
  }

  return nonce
}

/** All addresses that have ever appeared in a game (lowercased). */
export async function getIndexedPlayers(): Promise<string[]> {
  return (await getRedis().smembers(K.players)) as string[]
}

/** gameIds a given address has participated in, newest-id first. */
export async function getPlayerGameIds(address: string): Promise<number[]> {
  const ids = (await getRedis().smembers(K.playerGames(address))) as Array<string | number>
  return ids.map(Number).sort((a, b) => b - a)
}
