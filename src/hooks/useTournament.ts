'use client'

import { useState, useEffect, useCallback } from 'react'

export interface TournamentBoardEntry {
  address: string
  xp: number
  wins: number
  losses: number
  draws: number
  games: number
  eligible: boolean
  rank: number
}

export interface TournamentPrizeWinner {
  place: number
  address: string
  amount: number
}

export interface TournamentWindowMeta {
  seasonIndex: number
  id: string
  name: string
  startsAt: number
  endsAt: number
  status: 'upcoming' | 'live' | 'ended'
  prizePool: number
  currency: string
  splits: { place: number; amount: number }[]
}

export interface TournamentData {
  /** null during a rest week — no season is running. */
  window: TournamentWindowMeta | null
  board: TournamentBoardEntry[]
  winners: TournamentPrizeWinner[]
  frozen: boolean
  /** Only set while idle, and only once the next season has been scheduled. */
  next?: TournamentWindowMeta | null
}

export function useTournament() {
  const [payload, setData] = useState<TournamentData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchTournament = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/tournament/current')
      const body = (await res.json().catch(() => null)) as TournamentData | null
      if (body && body.window) setData(body)
    } catch (err) {
      console.error('[useTournament] fetch failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTournament()
  }, [fetchTournament])

  return { payload, isLoading, refresh: fetchTournament }
}
