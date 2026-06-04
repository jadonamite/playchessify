'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const LOG_PREFIX = '[useGameMoves]'
const POLL_INTERVAL_MS = 1_500

export type Chain = 'celo'

export interface MoveRecord {
  san: string
  player: string
  moveNumber: number
  ts: number
}

interface UseGameMovesOptions {
  chain: Chain | null
  gameId: number
  enabled: boolean
}

interface UseGameMovesResult {
  moves: MoveRecord[]
  isLoading: boolean
  error: string | null
  submitMove: (san: string, player: string) => Promise<boolean>
  refresh: () => Promise<void>
}

/**
 * Sync moves for a game via the relay API. Polls every 2s for opponent moves;
 * submitMove appends a new move to the relay. Race-safe via moveNumber on POST.
 */
export function useGameMoves({ chain, gameId, enabled }: UseGameMovesOptions): UseGameMovesResult {
  const [moves, setMoves] = useState<MoveRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Latest known move count, used by submitMove to assign a moveNumber without
  // a re-render race between state read and POST.
  const movesRef = useRef<MoveRecord[]>([])
  useEffect(() => { movesRef.current = moves }, [moves])

  const refresh = useCallback(async () => {
    if (!chain || gameId === undefined || gameId === null) return
    try {
      const res = await fetch(`/api/games/${chain}/${gameId}/moves`, { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as { moves: MoveRecord[] }
      const incoming = data.moves ?? []
      // Monotonic guard: only accept the polled state if it has at least as
      // many moves as we already know about locally. A poll that started
      // before a local POST resolved can otherwise come back with a stale
      // shorter list and revert the player's just-committed move.
      setMoves((prev) => (incoming.length > prev.length ? incoming : prev))
      setError(null)
    } catch (err) {
      console.error(`${LOG_PREFIX} refresh failed`, err)
      setError(err instanceof Error ? err.message : 'relay error')
    }
  }, [chain, gameId])

  // Initial load + polling
  useEffect(() => {
    if (!enabled || !chain || gameId === undefined || gameId === null) return

    setIsLoading(true)
    void refresh().finally(() => setIsLoading(false))

    const interval = setInterval(() => { void refresh() }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [enabled, chain, gameId, refresh])

  const submitMove = useCallback(async (san: string, player: string): Promise<boolean> => {
    if (!chain || gameId === undefined || gameId === null) return false

    const moveNumber = movesRef.current.length + 1
    try {
      const res = await fetch(`/api/games/${chain}/${gameId}/moves`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ san, player, moveNumber }),
      })
      const body = await res.json().catch(() => ({}))

      if (res.status === 409) {
        // Opponent's move beat us to this slot — re-sync and let caller decide
        console.warn(`${LOG_PREFIX} submitMove conflict — relay had ${body?.moves?.length} moves`, { gameId, moveNumber })
        if (Array.isArray(body?.moves)) setMoves(body.moves)
        return false
      }
      if (!res.ok) {
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }

      // Append locally so the UI updates without waiting for the next poll
      const newMove = body.move as MoveRecord
      setMoves((prev) => [...prev, newMove])
      console.info(`${LOG_PREFIX} submitMove ok`, { gameId, moveNumber, san })
      return true
    } catch (err) {
      console.error(`${LOG_PREFIX} submitMove failed`, err)
      setError(err instanceof Error ? err.message : 'submit failed')
      return false
    }
  }, [chain, gameId])

  return { moves, isLoading, error, submitMove, refresh }
}
