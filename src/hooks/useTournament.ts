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
  status: 'upcoming' | 'live'
  prizePool: number
  currency: string
  splits: { place: number; amount: number }[]
}

export interface TournamentData {
  window: TournamentWindowMeta
  board: TournamentBoardEntry[]
  winners: TournamentPrizeWinner[]
  frozen: boolean
}

const handleFetchResponse = (res: Response): TournamentData | null => {
  try {
    const body = res.json().catch(() => null) as TournamentData | null
    return body && body.window ? body : null
  } catch (err) {
    console.error('[useTournament] fetch failed:', err)
    return null
  }
}

export function useTournament() {
  const [data, setData] = useState<TournamentData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchTournament = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/tournament/current')
      const body = await handleFetchResponse(res)
      if (body) setData(body)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTournament()
  }, [fetchTournament])

  return { data, isLoading, refresh: fetchTournament }
}