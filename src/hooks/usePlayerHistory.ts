'use client'

import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { CELO_CONTRACTS, CELO_CHAIN_ID, TOKEN_DECIMALS } from '@/config/contracts'
import { CHESS_GAME_ABI } from '@/config/abis'
import { formatUnits, type Abi } from 'viem'

export type PlayerHistoryItem = {
  id: string
  role: 'white' | 'black'
  opponent: string
  wager: string
  status: string
  result: 'win' | 'loss' | 'draw' | 'active' | 'waiting'
}

const STATUS_LABELS = ['Waiting', 'Active', 'Finished', 'Cancelled', 'Draw']
const ZERO = '0x0000000000000000000000000000000000000000'
const MAX_SCAN = 40 // scan last N games to limit RPC calls

export function usePlayerHistory(playerAddress: string | null | undefined) {
  const publicClient = usePublicClient({ chainId: CELO_CHAIN_ID })

  return useQuery({
    queryKey: ['player-history', playerAddress?.toLowerCase()],
    queryFn: async (): Promise<PlayerHistoryItem[]> => {
      if (!playerAddress || !publicClient) return []
      const me = playerAddress.toLowerCase()

      const gameNonce = await publicClient.readContract({
        address: CELO_CONTRACTS.game as `0x${string}`,
        abi: CHESS_GAME_ABI as Abi,
        functionName: 'gameNonce',
      }) as bigint

      const total = Number(gameNonce)
      if (total === 0) return []

      // Scan last MAX_SCAN games — recent ones most likely to include this player
      const start = Math.max(1, total - MAX_SCAN + 1)
      const ids = Array.from({ length: total - start + 1 }, (_, i) => BigInt(start + i))

      const results = await publicClient.multicall({
        contracts: ids.map((id) => ({
          address: CELO_CONTRACTS.game as `0x${string}`,
          abi: CHESS_GAME_ABI as Abi,
          functionName: 'getGame',
          args: [id],
        })),
        allowFailure: true,
      })

      const items: PlayerHistoryItem[] = []

      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        if (r.status !== 'success') continue
        const g = r.result as any
        const white = (g.white as string).toLowerCase()
        const black = (g.black as string).toLowerCase()
        if (white !== me && black !== me) continue

        const role: 'white' | 'black' = white === me ? 'white' : 'black'
        const opponent = role === 'white' ? g.black : g.white
        const statusIdx = Number(g.status)
        const status = STATUS_LABELS[statusIdx] ?? 'Unknown'

        let result: PlayerHistoryItem['result'] = 'active'
        if (statusIdx === 0) result = 'waiting'
        else if (statusIdx === 1) result = 'active'
        else if (statusIdx === 4) result = 'draw'
        else if (statusIdx === 2) {
          // Finished — winner is whoever called reportWin; approximate via ELO not available here
          // Can't determine win/loss without winner field in contract; show as 'win'/'loss' based on loser
          const loser = (g.loser as string | undefined)?.toLowerCase()
          if (loser) result = loser === me ? 'loss' : 'win'
          else result = 'active' // unknown
        }

        items.push({
          id: String(start + i),
          role,
          opponent: opponent.toLowerCase() === ZERO ? '' : opponent,
          wager: formatUnits(g.wager as bigint, TOKEN_DECIMALS),
          status,
          result,
        })
      }

      return items.reverse() // most recent first
    },
    enabled: !!playerAddress && !!publicClient,
    staleTime: 2 * 60 * 1000,
    retry: false,
  })
}
