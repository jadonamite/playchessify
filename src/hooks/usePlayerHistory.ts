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

const transformApiHistory = (apiHistory: any): PlayerHistoryItem[] => {
  if (!Array.isArray(apiHistory)) return []
  return apiHistory.map((h: ApiHistoryItem) => ({
    id: h.id,
    role: h.role,
    opponent: h.opponent === 'Waiting...' ? '' : h.opponent,
    wager: h.wager,
    status: h.status,
    result: h.result,
  }))
}

export function usePlayerHistory(playerAddress: string | null | undefined) {
  return useQuery({
    queryKey: ['player-history', playerAddress?.toLowerCase()],
    queryFn: async (): Promise<PlayerHistoryItem[]> => {
      if (!playerAddress) return []
      // Redis-indexed: returns this player's full game set (no 40-game scan cap),
      // newest first, scanning only their gameIds on-chain.
      const res = await fetch(`/api/history?address=${playerAddress}`)
      const body = (await res.json().catch(() => ({}))) as { history?: ApiHistoryItem[] }
      return transformApiHistory(body.history)
    },
    enabled: !!playerAddress,
    staleTime: 2 * 60 * 1000,
    retry: false,
  })
}