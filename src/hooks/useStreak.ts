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

/** 'play' = the daily play streak; 'win' = the daily WIN streak ("stars"). */
export type StreakKind = 'play' | 'win'

/** Event the caller dispatches to pop the full-page streak overlay (mounted in
 *  the app layout). `earned` = a real celebration after a completed game;
 *  `nudge` = a daily motivational prompt for users sitting on a 0 streak. */
export const STREAK_EVENT = 'chessify:streak'

export interface StreakEventDetail {
  mode: 'earned' | 'nudge'
  current: number
  longest: number
}

/** Per-UTC-day localStorage guards — one show per day for each overlay mode.
 *  Shared so the dispatcher (lobby) and the overlay agree on the same key. */
export const STREAK_CELEBRATED_KEY = 'chess:streak:celebrated'
export const STREAK_NUDGE_KEY = 'chess:streak:nudge'

/** UTC calendar day as YYYY-MM-DD (matches the server's day boundary). */
export function streakDay(): string {
  return new Date().toISOString().slice(0, 10)
}

export function dispatchStreak(detail: StreakEventDetail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STREAK_EVENT, { detail }))
  }
}

// ── read ──────────────────────────────────────────────────────────────────────

/** Live streak for an address (nav badge, profile, faucet). `kind` selects the
 *  play streak (default) or the win streak ("stars"). */
export function useStreak(address?: string | null, kind: StreakKind = 'play') {
  const query = useQuery<StreakData>({
    queryKey: ['streak', kind, address?.toLowerCase()],
    enabled: !!address,
    staleTime: 30_000,
    queryFn: async () => {
      const qs = kind === 'win' ? `&kind=win` : ''
      const res = await fetch(`/api/profile/streak?address=${address}${qs}`, { cache: 'no-store' })
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
    async (source: ClientSource, kind: StreakKind = 'play'): Promise<RecordResult | null> => {
      if (!isConnected || !playerAddress) return null
      try {
        const res = await fetch('/api/profile/streak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: playerAddress, source, kind }),
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
