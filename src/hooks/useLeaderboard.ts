'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePublicClient, useAccount } from 'wagmi'
import type { Abi } from 'viem'
import { CELO_CONTRACTS } from '@/config/contracts'
import { CHESS_GAME_ABI } from '@/config/abis'

export interface LeaderboardEntry {
  address: string
  wins: number
  losses: number
  draws: number
  rating: number
  gamesPlayed: number
  rank: number
}

export function useLeaderboard() {
  const publicClient = usePublicClient()
  const { address: myAddress } = useAccount()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchLeaderboard = useCallback(async () => {
    if (!publicClient) return
    setIsLoading(true)
    try {
      const [createdLogs, joinedLogs] = await Promise.all([
        publicClient.getLogs({
          address: CELO_CONTRACTS.game as `0x${string}`,
          event: {
            type: 'event',
            name: 'GameCreated',
            inputs: [
              { name: 'gameId', type: 'uint256', indexed: true },
              { name: 'white', type: 'address', indexed: true },
              { name: 'wager', type: 'uint256', indexed: false },
            ],
          },
          fromBlock: 0n,
        }),
        publicClient.getLogs({
          address: CELO_CONTRACTS.game as `0x${string}`,
          event: {
            type: 'event',
            name: 'GameJoined',
            inputs: [
              { name: 'gameId', type: 'uint256', indexed: true },
              { name: 'black', type: 'address', indexed: true },
            ],
          },
          fromBlock: 0n,
        }),
      ])

      const addressSet = new Set<string>()
      for (const log of createdLogs) {
        if (log.args.white) addressSet.add(log.args.white.toLowerCase())
      }
      for (const log of joinedLogs) {
        if (log.args.black) addressSet.add(log.args.black.toLowerCase())
      }

      const addresses = Array.from(addressSet)
      if (addresses.length === 0) {
        setEntries([])
        return
      }

      const results = await publicClient.multicall({
        contracts: addresses.map((addr) => ({
          address: CELO_CONTRACTS.game as `0x${string}`,
          abi: CHESS_GAME_ABI as Abi,
          functionName: 'playerStats',
          args: [addr as `0x${string}`],
        })),
        allowFailure: true,
      })

      const leaderboard: LeaderboardEntry[] = []
      for (let i = 0; i < addresses.length; i++) {
        const result = results[i]
        if (result.status !== 'success') continue
        const r = result.result as unknown as [bigint, bigint, bigint, bigint, bigint]
        const gamesPlayed = Number(r[4])
        if (gamesPlayed === 0) continue
        leaderboard.push({
          address: addresses[i],
          wins: Number(r[0]),
          losses: Number(r[1]),
          draws: Number(r[2]),
          rating: Number(r[3]),
          gamesPlayed,
          rank: 0,
        })
      }

      // Sort: rating desc, then wins desc as tiebreak
      leaderboard.sort((a, b) => b.rating - a.rating || b.wins - a.wins)
      leaderboard.forEach((e, i) => { e.rank = i + 1 })

      setEntries(leaderboard)
    } catch (err) {
      console.error('[useLeaderboard] fetch failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [publicClient])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  const myRank = myAddress
    ? (entries.find((e) => e.address === myAddress.toLowerCase())?.rank ?? null)
    : null

  return { entries, isLoading, myRank, refresh: fetchLeaderboard }
}
