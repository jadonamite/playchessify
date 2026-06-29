'use client'

import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSignMessage } from 'wagmi'
import { useWallet } from '@/components/wallet-provider'

export interface StreakData {
  current: number
  longest: number
  lastPlayedDate: string
  playedToday: boolean
}

export interface RecordResult extends StreakData {
  incremented: boolean
}

type ClientSource = 'bot' | 'puzzle'

/** Event fired when a play advances/resets the streak — the full-page
 *  celebration overlay (mounted in the app layout) listens for this. */
export const STREAK_EVENT = 'chessify:streak'

function utcToday(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── read ──────────────────────────────────────────────────────────────────────

/** Live streak for an address (nav badge, profile, faucet). */
export function useStreak(address?: string | null) {
  const query = useQuery<StreakData>({
    queryKey: ['streak', address?.toLowerCase()],
    enabled: !!address,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch(`/api/profile/streak?address=${address}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('streak fetch failed')
      return res.json()
    },
  })
  return {
    streak: query.data ?? { current: 0, longest: 0, lastPlayedDate: '', playedToday: false },
    isLoading: query.isLoading,
    refresh: query.refetch,
  }
}

// ── record (client-attested: bot / puzzle) ─────────────────────────────────────

/**
 * Returns a `record(source)` callback that signs a domain-bound message and
 * posts it to record a streak day. No-ops if disconnected or already recorded
 * for this source today (so a signature is requested at most once per day).
 */
export function useRecordStreak() {
  const { playerAddress, isConnected } = useWallet()
  const { signMessageAsync } = useSignMessage()

  return useCallback(
    async (source: ClientSource): Promise<RecordResult | null> => {
      if (!isConnected || !playerAddress) return null

      const localKey = `chess:streak:recorded:${source}`
      const today = utcToday()
      try {
        if (localStorage.getItem(localKey) === today) return null
      } catch { /* storage blocked — fall through and just record */ }

      const timestamp = new Date().toISOString()
      const message = `Chessify Streak\n\nSource: ${source}\nAddress: ${playerAddress}\nTimestamp: ${timestamp}`

      let signature: string
      try {
        signature = await signMessageAsync({ message })
      } catch {
        return null // user dismissed the signature — try again next completion
      }

      try {
        const res = await fetch('/api/profile/streak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: playerAddress, source, signature, timestamp }),
        })
        if (!res.ok) return null
        const result = (await res.json()) as RecordResult

        try { localStorage.setItem(localKey, today) } catch { /* ignore */ }

        if (result.incremented && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(STREAK_EVENT, { detail: result }))
        }
        return result
      } catch {
        return null
      }
    },
    [isConnected, playerAddress, signMessageAsync],
  )
}
