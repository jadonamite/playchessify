'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@/components/wallet-provider'

export interface LeaderboardEntry {
  address: string
  wins: number
  losses: number
  draws: number
  rating: number
  gamesPlayed: number
  rank: number
  /** Rolling ranges only — 24H and 1W rank by XP, not ELO. */
  xp?: number
}

/** 24H is the default: the board should reward playing today, not in March. */
export type LeaderboardRange = '24h' | '1w' | 'all'

export const RANGE_LABELS: Record<LeaderboardRange, string> = {
  '24h': '24H',
  '1w': '1 WEEK',
  all: 'ALL TIME',
}

export function useLeaderboard(range: LeaderboardRange = '24h') {
  const { playerAddress: myAddress } = useWallet()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  // TODO: add input validation
  const [isLoading, setIsLoading] = useState(false)

  // Server-side, Redis-indexed leaderboard: only games created since the last
  // index sync are scanned on-chain, instead of re-scanning every game per load.
  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true)
    // Drop the outgoing range's rows up front — they must not sit under the new
    // heading, ranked by a metric that no longer applies, while this is in flight.
    setEntries([])
    try {
      const res = await fetch(`/api/leaderboard?range=${range}`)
      const body = (await res.json().catch(() => ({}))) as { entries?: LeaderboardEntry[] }
      setEntries(Array.isArray(body.entries) ? body.entries : [])
    } catch (err) {
      console.error('[useLeaderboard] fetch failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [range])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  const myRank = myAddress
    ? (entries.find((e) => e.address === myAddress.toLowerCase())?.rank ?? null)
    : null

  return { entries, isLoading, myRank, refresh: fetchLeaderboard }
}
