import { NextResponse } from 'next/server' 
import { Redis } from '@upstash/redis'
import type { Abi } from 'viem'
import { getPublicClient } from '@/lib/celo-server'
import { syncGameIndex, getIndexedPlayers } from '@/lib/game-index'
import { isBotAddress } from '@/config/bots'
import { CELO_CONTRACTS } from '@/config/contracts'
import { CHESS_GAME_ABI } from '@/config/abis'
import { getRollingBoard } from '@/lib/tournament'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GAME = CELO_CONTRACTS.game as `0x${string}`
const CACHE_KEY = 'chess:v2:idx:leaderboard'
const CACHE_TTL = 20 // seconds — stats change slowly; bounds multicall load

/**
 * Ranking ranges. `all` ranks by ELO from the contract's cumulative playerStats;
 * the rolling windows rank by XP, because the chain keeps one rating per player
 * and no history to slice — see getRollingBoard in src/lib/tournament.ts.
 */
export const RANGES = {
  '24h': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
} as const

export type LeaderboardRange = keyof typeof RANGES | 'all'

const rangeKey = (range: LeaderboardRange) => `${CACHE_KEY}:${range}`

export interface LeaderboardEntry {
  address: string
  wins: number
  losses: number
  draws: number
  rating: number
  gamesPlayed: number
  rank: number
  /** Rolling ranges only — the metric they're actually ranked by. */
  xp?: number
}

function getRedis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
}

// Helper function to process player stats results and create leaderboard entries
function createLeaderboardEntries(addresses: string[], statsResults: any[]): LeaderboardEntry[] {
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
  return entries
}

// GET /api/leaderboard — Redis-indexed leaderboard. Scans only games created
// since the last index sync (cursor), then reads playerStats for known players.
export async function GET(req: Request) {
  try {
    const raw = new URL(req.url).searchParams.get('range')
    const range: LeaderboardRange = raw === 'all' || raw === '1w' || raw === '24h' ? raw : '24h'

    const redis = getRedis()
    const cached = await redis.get<LeaderboardEntry[]>(rangeKey(range))
    if (cached) return NextResponse.json({ entries: cached, range, cached: true })

    if (range !== 'all') {
      const board = await getRollingBoard(RANGES[range])
      const windowed: LeaderboardEntry[] = board.map((e) => ({
        address: e.address,
        wins: e.wins,
        losses: e.losses,
        draws: e.draws,
        rating: 0, // no windowed ELO exists — the XP field is what ranks here
        gamesPlayed: e.games,
        rank: e.rank,
        xp: e.xp,
      }))
      await redis.set(rangeKey(range), windowed, { ex: CACHE_TTL })
      return NextResponse.json({ entries: windowed, range })
    }

    await syncGameIndex()
    // Bots play real games but never rank — their opponents' stats still count.
    const addresses = (await getIndexedPlayers()).filter((a) => !isBotAddress(a))
    if (addresses.length === 0) return NextResponse.json({ entries: [], range })
    const statsResults = await getPublicClient().multicall({
      contracts: addresses.map((addr) => ({
        address: GAME,
        abi: CHESS_GAME_ABI as Abi,
        functionName: 'playerStats',
        args: [addr as `0x${string}`],
      })),
      allowFailure: true,
    })
    const entries = createLeaderboardEntries(addresses, statsResults)
    entries.sort((a, b) => b.rating - a.rating || b.wins - a.wins)
    entries.forEach((e, i) => {
      e.rank = i + 1
    })
    await redis.set(rangeKey(range), entries, { ex: CACHE_TTL })
    return NextResponse.json({ entries, range })
  } catch (err) {
    console.error('[api/leaderboard] failed:', (err as Error)?.message)
    return NextResponse.json({ error: 'leaderboard unavailable' }, { status: 503 })
  }
}