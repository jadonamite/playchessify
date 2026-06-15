import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import type { Abi } from 'viem'
import { getPublicClient } from '@/lib/celo-server'
import { syncGameIndex, getIndexedPlayers } from '@/lib/game-index'
import { CELO_CONTRACTS } from '@/config/contracts'
import { CHESS_GAME_ABI } from '@/config/abis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GAME = CELO_CONTRACTS.game as `0x${string}`
const CACHE_KEY = 'chess:idx:leaderboard'
const CACHE_TTL = 20 // seconds — stats change slowly; bounds multicall load

export interface LeaderboardEntry {
  address: string
  wins: number
  losses: number
  draws: number
  rating: number
  gamesPlayed: number
  rank: number
}

function getRedis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
}

// GET /api/leaderboard — Redis-indexed leaderboard. Scans only games created
// since the last index sync (cursor), then reads playerStats for known players.
export async function GET() {
  try {
    const redis = getRedis()

    const cached = await redis.get<LeaderboardEntry[]>(CACHE_KEY)
    if (cached) return NextResponse.json({ entries: cached, cached: true })

    await syncGameIndex()
    const addresses = await getIndexedPlayers()
    if (addresses.length === 0) return NextResponse.json({ entries: [] })

    const statsResults = await getPublicClient().multicall({
      contracts: addresses.map((addr) => ({
        address: GAME,
        abi: CHESS_GAME_ABI as Abi,
        functionName: 'playerStats',
        args: [addr as `0x${string}`],
      })),
      allowFailure: true,
    })

    const entries: LeaderboardEntry[] = []
    for (let i = 0; i < addresses.length; i++) {
      const result = statsResults[i]
      if (result.status !== 'success') continue
      const r = result.result as readonly [bigint, bigint, bigint, bigint, bigint]
      const gamesPlayed = Number(r[4])
      if (gamesPlayed === 0) continue
      entries.push({
        address: addresses[i],
        wins: Number(r[0]),
        losses: Number(r[1]),
        draws: Number(r[2]),
        rating: Number(r[3]),
        gamesPlayed,
        rank: 0,
      })
    }

    entries.sort((a, b) => b.rating - a.rating || b.wins - a.wins)
    entries.forEach((e, i) => { e.rank = i + 1 })

    await redis.set(CACHE_KEY, entries, { ex: CACHE_TTL })
    return NextResponse.json({ entries })
  } catch (err) {
    console.error('[api/leaderboard] failed:', (err as Error)?.message)
    return NextResponse.json({ error: 'leaderboard unavailable' }, { status: 503 })
  }
}
