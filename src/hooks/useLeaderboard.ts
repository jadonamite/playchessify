'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePublicClient, useAccount } from 'wagmi'
import type { Abi } from 'viem'
import { CELO_CONTRACTS, CELO_CHAIN_ID } from '@/config/contracts'
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

const ZERO = '0x0000000000000000000000000000000000000000'

export function useLeaderboard() {
  const publicClient = usePublicClient({ chainId: CELO_CHAIN_ID })
  const { address: myAddress } = useAccount()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchLeaderboard = useCallback(async () => {
    if (!publicClient) return
    setIsLoading(true)
    try {
      const gameNonce = await publicClient.readContract({
        address: CELO_CONTRACTS.game as `0x${string}`,
        abi: CHESS_GAME_ABI as Abi,
        functionName: 'gameNonce',
      }) as bigint

      const total = Number(gameNonce)
      if (total === 0) {
        setEntries([])
        return
      }

      // Collect unique player addresses from all games
      const ids = Array.from({ length: total }, (_, i) => BigInt(i + 1))
      const gameResults = await publicClient.multicall({
        contracts: ids.map((id) => ({
          address: CELO_CONTRACTS.game as `0x${string}`,
          abi: CHESS_GAME_ABI as Abi,
          functionName: 'getGame',
          args: [id],
        })),
        allowFailure: true,
      })

      const addressSet = new Set<string>()
      for (const r of gameResults) {
        if (r.status !== 'success') continue
        const g = r.result as any
        const w = (g.white as string).toLowerCase()
        const b = (g.black as string).toLowerCase()
        if (w !== ZERO) addressSet.add(w)
        if (b !== ZERO) addressSet.add(b)
      }

      const addresses = Array.from(addressSet)
      if (addresses.length === 0) {
        setEntries([])
        return
      }

      const statsResults = await publicClient.multicall({
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
        const result = statsResults[i]
        if (result.status !== 'success') continue
        // viem returns named outputs as an object
        const r = result.result as { wins: bigint; losses: bigint; draws: bigint; rating: bigint; gamesPlayed: bigint }
        const gamesPlayed = Number(r.gamesPlayed)
        if (gamesPlayed === 0) continue
        leaderboard.push({
          address: addresses[i],
          wins: Number(r.wins),
          losses: Number(r.losses),
          draws: Number(r.draws),
          rating: Number(r.rating),
          gamesPlayed,
          rank: 0,
        })
      }

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
