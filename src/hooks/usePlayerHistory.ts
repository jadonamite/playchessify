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

const fetchPlayerHistory = async (playerAddress: string): Promise<PlayerHistoryItem[]> => {
  const res = await fetch(`/api/history?address=${playerAddress}`)
  const body = (await res.json().catch(() => ({}))) as { history?: ApiHistoryItem[] }
  if (!Array.isArray(body.history)) return []
  return body.history.map((h) => ({
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
    queryFn: async () => {
      if (!playerAddress) return []
      return fetchPlayerHistory(playerAddress)
    },
    enabled: !!playerAddress,
    staleTime: 2 * 60 * 1000,
    retry: false,
  })
}