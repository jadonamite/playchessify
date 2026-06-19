'use client'
import { useQuery } from '@tanstack/react-query'

export type PlayerHistoryItem = {
  id: string
  role: 'white' | 'black'
  opponent: string
  wager: string
  status: string
  result: 'win' | 'loss' | 'draw' | 'active' | 'waiting'
}

type ApiHistoryItem = PlayerHistoryItem & {
  chain: string
  opponent: string
  timestamp: number
}

const transformHistoryItem = (item: ApiHistoryItem): PlayerHistoryItem => ({
  id: item.id,
  role: item.role,
  opponent: item.opponent === 'Waiting...' ? '' : item.opponent,
  wager: item.wager,
  status: item.status,
  result: item.result,
})

export function usePlayerHistory(playerAddress: string | null | undefined) {
  return useQuery({
    queryKey: ['player-history', playerAddress?.toLowerCase()],
    queryFn: async (): Promise<PlayerHistoryItem[]> => {
      if (!playerAddress) return []
      // Redis-indexed: returns this player's full game set (no 40-game scan cap),
      // newest first, scanning only their gameIds on-chain.
      const res = await fetch(`/api/history?address=${playerAddress}`)
      const body = (await res.json().catch(() => ({}))) as { history?: ApiHistoryItem[] }
      if (!Array.isArray(body.history)) return []
      return body.history.map(transformHistoryItem)
    },
    enabled: !!playerAddress,
    staleTime: 2 * 60 * 1000,
    retry: false,
  })
}