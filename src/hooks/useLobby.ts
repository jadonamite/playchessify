import { useState, useEffect, useCallback } from 'react'
import { usePublicClient } from 'wagmi'
import { CHESS_GAME_ABI } from '@/config/abis'
import { CELO_CONTRACTS } from '@/config/contracts'

export interface Game {
  id: number
  creator: string
  wager: number
  chain: 'celo'
  elo: number
}

export function useLobby() {
  const publicClient = usePublicClient()
  const [games, setGames] = useState<Game[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchGames = useCallback(async () => {
    if (!publicClient) return []
    try {
      const nonce = await publicClient.readContract({
        address: CELO_CONTRACTS.game as `0x${string}`,
        abi: CHESS_GAME_ABI,
        functionName: 'gameNonce',
      }) as bigint

      const result: Game[] = []
      const start = Number(nonce) - 1
      const end = Math.max(0, start - 9)

      for (let i = start; i >= end; i--) {
        const g = await publicClient.readContract({
          address: CELO_CONTRACTS.game as `0x${string}`,
          abi: CHESS_GAME_ABI,
          functionName: 'getGame',
          args: [BigInt(i)]
        }) as any

        if (g && Number(g.status) === 0 && g.white !== '0x0000000000000000000000000000000000000000') {
          result.push({
            id: i,
            creator: g.white,
            wager: Number(g.wager) / 1e6,
            chain: 'celo',
            elo: 1200,
          })
        }
      }
      return result
    } catch (err) {
      console.error('Lobby fetch error:', err)
      return []
    }
  }, [publicClient])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    const list = await fetchGames()
    setGames(list)
    setIsLoading(false)
  }, [fetchGames])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [refresh])

  return { games, isLoading, refresh }
}
