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
}

const findMyRank = (entries: LeaderboardEntry[], myAddress: string | null): number | null => {
  if (!myAddress) return null
  const myEntry = entries.find((e) => e.address === myAddress.toLowerCase())
  return myEntry?.rank ?? null
}

export function useLeaderboard() {
  const { playerAddress: myAddress } = useWallet()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Server-side, Redis-indexed leaderboard: only games created since the last
  // index sync are scanned on-chain, instead of re-scanning every game per load.
  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/leaderboard')
      const body = (await res.json().catch(() => ({}))) as { entries?: LeaderboardEntry[] }
      setEntries(Array.isArray(body.entries) ? body.entries : [])
    } catch (err) {
      console.error('[useLeaderboard] fetch failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  const myRank = findMyRank(entries, myAddress)

  return { entries, isLoading, myRank, refresh: fetchLeaderboard }
}