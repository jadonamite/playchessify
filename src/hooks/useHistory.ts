'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'

export type HistoryItem = {
  id: string
  chain: 'celo'
  role: 'white' | 'black'
  opponent: string
  wager: string
  status: string
  result: 'win' | 'loss' | 'draw' | 'active' | 'waiting'
  timestamp: number
}

export function useHistory() {
  const { address: celoAddress } = useAccount()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Server-side, Redis-indexed: only this player's gameIds are read on-chain.
  const fetchHistory = useCallback(async (): Promise<HistoryItem[]> => {
    if (!celoAddress) return []
    try {
      const res = await fetch(`/api/history?address=${celoAddress}`)
      const body = (await res.json().catch(() => ({}))) as { history?: HistoryItem[] }
      return Array.isArray(body.history) ? body.history : []
    } catch (err) {
      console.error('[useHistory] fetch failed:', err)
      return []
    }
  }, [celoAddress])

  const refreshHistory = useCallback(async () => {
    setIsLoading(true)
    const items = await fetchHistory()
    setHistory(items)
    setIsLoading(false)
  }, [fetchHistory])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch history on mount
    refreshHistory()
  }, [refreshHistory])

  return { history, isLoading, refreshHistory }
}
