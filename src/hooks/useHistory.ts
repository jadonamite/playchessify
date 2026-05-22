'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { CELO_CONTRACTS, TOKEN_DECIMALS } from '@/config/contracts'
import { CHESS_GAME_ABI } from '@/config/abis'
import { formatUnits } from 'viem'

export type HistoryItem = {
  id: string
  chain: 'celo'
  role: 'white' | 'black'
  opponent: string
  wager: string
  status: string
  timestamp: number
}

export function useHistory() {
  const { address: celoAddress } = useAccount()
  const publicClient = usePublicClient()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchHistory = useCallback(async () => {
    if (!celoAddress || !publicClient) return []

    try {
      const createdLogs = await publicClient.getLogs({
        address: CELO_CONTRACTS.game as `0x${string}`,
        event: {
          type: 'event',
          name: 'GameCreated',
          inputs: [
            { name: 'gameId', type: 'uint256', indexed: true },
            { name: 'white', type: 'address', indexed: true },
            { name: 'wager', type: 'uint256', indexed: false }
          ]
        },
        args: { white: celoAddress },
        fromBlock: 0n
      })

      const joinedLogs = await publicClient.getLogs({
        address: CELO_CONTRACTS.game as `0x${string}`,
        event: {
          type: 'event',
          name: 'GameJoined',
          inputs: [
            { name: 'gameId', type: 'uint256', indexed: true },
            { name: 'black', type: 'address', indexed: true }
          ]
        },
        args: { black: celoAddress },
        fromBlock: 0n
      })

      const items: HistoryItem[] = []

      for (const log of createdLogs) {
        const gameId = log.args.gameId?.toString() || '0'
        const gameData = await publicClient.readContract({
          address: CELO_CONTRACTS.game as `0x${string}`,
          abi: CHESS_GAME_ABI,
          functionName: 'getGame',
          args: [BigInt(gameId)]
        }) as any

        items.push({
          id: gameId,
          chain: 'celo',
          role: 'white',
          opponent: gameData.black === '0x0000000000000000000000000000000000000000' ? 'Waiting...' : gameData.black,
          wager: formatUnits(gameData.wager, TOKEN_DECIMALS),
          status: ['Waiting', 'Active', 'Finished', 'Cancelled', 'Draw'][gameData.status],
          timestamp: Number(gameData.createdAt),
        })
      }

      for (const log of joinedLogs) {
        const gameId = log.args.gameId?.toString() || '0'
        const gameData = await publicClient.readContract({
          address: CELO_CONTRACTS.game as `0x${string}`,
          abi: CHESS_GAME_ABI,
          functionName: 'getGame',
          args: [BigInt(gameId)]
        }) as any

        items.push({
          id: gameId,
          chain: 'celo',
          role: 'black',
          opponent: gameData.white,
          wager: formatUnits(gameData.wager, TOKEN_DECIMALS),
          status: ['Waiting', 'Active', 'Finished', 'Cancelled', 'Draw'][gameData.status],
          timestamp: Number(gameData.createdAt),
        })
      }

      return items.sort((a, b) => b.timestamp - a.timestamp)
    } catch (err) {
      console.error('History fetch error:', err)
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
