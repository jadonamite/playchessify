'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@/components/wallet-provider'

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
  const { playerAddress } = useWallet()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Server-side, Redis-indexed: only this player's gameIds are read on-chain.
  const fetchHistory = useCallback(async (): Promise<HistoryItem[]> => {
    if (!playerAddress) return []
    try {
      const res = await fetch(`/api/history?address=${playerAddress}`)
      const body = (await res.json().catch(() => ({}))) as { history?: HistoryItem[] }
      return Array.isArray(body.history) ? body.history : []
    } catch (err) {
      console.error('[useHistory] fetch failed:', err)
      return []
    }
  }, [playerAddress])

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
