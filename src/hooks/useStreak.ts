'use client'

import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
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

type ClientSource = 'bot' | 'puzzle' | 'multiplayer'

/** Event the caller dispatches to pop the full-page streak overlay (mounted in
 *  the app layout). `earned` = a real celebration after a completed game;
 *  `nudge` = a daily motivational prompt for users sitting on a 0 streak. */
export const STREAK_EVENT = 'chessify:streak'

export interface StreakEventDetail {
  mode: 'earned' | 'nudge'
  current: number
  longest: number
}

export function dispatchStreak(detail: StreakEventDetail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STREAK_EVENT, { detail }))
  }
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
 * Returns a `record(source)` callback that records a completed play day. No
 * signature, no popup — a streak is a vanity counter (no payout). Returns the
 * resulting streak so the caller can decide when to celebrate; no-ops (returns
 * null) if disconnected.
 */
export function useRecordStreak() {
  const { playerAddress, isConnected } = useWallet()

  return useCallback(
    async (source: ClientSource): Promise<RecordResult | null> => {
      if (!isConnected || !playerAddress) return null
      try {
        const res = await fetch('/api/profile/streak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: playerAddress, source }),
        })
        if (!res.ok) return null
        return (await res.json()) as RecordResult
      } catch {
        return null
      }
    },
    [isConnected, playerAddress],
  )
}
