'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { CELO_CONTRACTS, CELO_CHAIN_ID, TOKEN_DECIMALS } from '@/config/contracts'
import { CHESS_GAME_ABI } from '@/config/abis'
import { formatUnits, type Abi } from 'viem'

export type HistoryItem = {
  id: string
  chain: 'celo'
  role: 'white' | 'black'
  opponent: string
  wager: string
  status: string
  timestamp: number
}

const STATUS_LABELS = ['Waiting', 'Active', 'Finished', 'Cancelled', 'Draw']
const ZERO = '0x0000000000000000000000000000000000000000'

export function useHistory() {
  const { address: celoAddress } = useAccount()
  const publicClient = usePublicClient({ chainId: CELO_CHAIN_ID })
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchHistory = useCallback(async () => {
    if (!celoAddress || !publicClient) return []
    try {
      const gameNonce = await publicClient.readContract({
        address: CELO_CONTRACTS.game as `0x${string}`,
        abi: CHESS_GAME_ABI as Abi,
        functionName: 'gameNonce',
      }) as bigint

      const total = Number(gameNonce)
      if (total === 0) return []

      const ids = Array.from({ length: total }, (_, i) => BigInt(i + 1))
      const results = await publicClient.multicall({
        contracts: ids.map((id) => ({
          address: CELO_CONTRACTS.game as `0x${string}`,
          abi: CHESS_GAME_ABI as Abi,
          functionName: 'getGame',
          args: [id],
        })),
        allowFailure: true,
      })

      const me = celoAddress.toLowerCase()
      const items: HistoryItem[] = []

      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        if (r.status !== 'success') continue
        const g = r.result as any
        const white = (g.white as string).toLowerCase()
        const black = (g.black as string).toLowerCase()
        if (white !== me && black !== me) continue

        const role: 'white' | 'black' = white === me ? 'white' : 'black'
        const opponent: string = role === 'white' ? g.black : g.white
        items.push({
          id: String(i + 1),
          chain: 'celo',
          role,
          opponent: opponent.toLowerCase() === ZERO ? 'Waiting...' : opponent,
          wager: formatUnits(g.wager as bigint, TOKEN_DECIMALS),
          status: STATUS_LABELS[Number(g.status)] ?? 'Unknown',
          timestamp: Number(g.createdAt),
        })
      }

      return items.sort((a, b) => b.timestamp - a.timestamp)
    } catch (err) {
      console.error('[useHistory] fetch failed:', err)
      return []
    }
  }, [celoAddress, publicClient])

  const refreshHistory = useCallback(async () => {
    setIsLoading(true)
    const items = await fetchHistory()
    setHistory(items)
    setIsLoading(false)
  }, [fetchHistory])

  useEffect(() => {
    refreshHistory()
  }, [refreshHistory])

  return { history, isLoading, refreshHistory }
}
