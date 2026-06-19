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

const parseHistoryResponse = (response: any): HistoryItem[] => {
  if (!response || !response.history) return []
  return Array.isArray(response.history) ? response.history : []
}

const handleFetchError = (err: any) => {
  console.error('[useHistory] fetch failed:', err)
  return []
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
      const body = await res.json().catch(() => ({}))
      return parseHistoryResponse(body)
    } catch (err) {
      return handleFetchError(err)
    }
  }, [playerAddress])

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