'use client'

import { useState, useEffect } from 'react'

export interface TournamentField {
  /** The Qualifiers gating the current event; null when the field is open. */
  from: string | null
  /** Seats in the closed field, or null when open/unavailable. */
  size: number | null
  /** Whether the gate resolved. False means "treat as open", never "nobody in". */
  resolved: boolean
  /** Membership for the connected wallet; null when no wallet is connected. */
  inField: boolean | null
}

/**
 * Closed-field status for the running event.
 *
 * Kept out of useTournament deliberately: the board endpoint rebuilds from
 * chain and is far too heavy to re-run per wallet, while this only reads a
 * frozen set. Returns null while unknown so callers render nothing rather
 * than guessing a player is shut out.
 */
export function useTournamentField(address?: string) {
  const [field, setField] = useState<TournamentField | null>(null)

  useEffect(() => {
    let cancelled = false
    const url = address
      ? `/api/tournament/field?address=${encodeURIComponent(address)}`
      : '/api/tournament/field'

    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: TournamentField | null) => {
        if (!cancelled && body && typeof body.resolved === 'boolean') setField(body)
      })
      .catch((err) => console.error('[useTournamentField] fetch failed:', err))

    return () => {
      cancelled = true
    }
  }, [address])

  return field
}
