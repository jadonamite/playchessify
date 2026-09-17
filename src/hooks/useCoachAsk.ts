'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * The ask meter, from the client's side.
 *
 * `remaining` here is display only. The real count lives in Redis behind
 * /api/coach/ask and is the one that decides — this copy exists so the button
 * can say "7 left" without a round trip, and it is re-synced from every server
 * response so the two cannot drift for long.
 */

export interface AskResult {
  text: string
  source: 'llm' | 'template'
  bestMoveSan: string | null
  /** The same move in words, e.g. "Knight to f6 (Nf6)". */
  bestMovePhrase: string | null
  evalCp: number
  mate: number | null
  remaining: number
}

export function useCoachAsk(gameKey: string | null) {
  const [remaining, setRemaining] = useState<number | null>(null)
  const [limit, setLimit] = useState(10)
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState<AskResult | null>(null)
  const [error, setError] = useState('')

  // Read the meter on mount so a player returning to a game sees the truth
  // rather than a fresh-looking ten.
  useEffect(() => {
    if (!gameKey) return
    let live = true
    fetch(`/api/coach/ask?gameKey=${encodeURIComponent(gameKey)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { remaining?: number; limit?: number } | null) => {
        if (!live || !d) return
        if (typeof d.remaining === 'number') setRemaining(d.remaining)
        if (typeof d.limit === 'number') setLimit(d.limit)
      })
      .catch(() => { /* the button falls back to enabled; the server still decides */ })
    return () => { live = false }
  }, [gameKey])

  const ask = useCallback(
    async (opts: { fen: string; coachId: string; learnerLevel?: string; lastMoveSan?: string }) => {
      if (!gameKey || asking) return
      setAsking(true)
      setError('')
      try {
        const res = await fetch('/api/coach/ask', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ gameKey, ...opts }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data?.message ?? data?.error ?? 'Could not reach your coach.')
          if (typeof data?.remaining === 'number') setRemaining(data.remaining)
          return
        }
        setAnswer(data as AskResult)
        if (typeof data.remaining === 'number') setRemaining(data.remaining)
      } catch {
        setError('Could not reach your coach.')
      } finally {
        setAsking(false)
      }
    },
    [gameKey, asking],
  )

  const dismiss = useCallback(() => setAnswer(null), [])

  /**
   * An opinion is about one position. Leaving it on screen after the board has
   * moved on presents stale advice as current — observed in testing, where an
   * answer recommending Re7 sat above an opening position for three more moves.
   */
  const clearOnPositionChange = useCallback(() => setAnswer(null), [])

  return { remaining, limit, asking, answer, error, ask, dismiss, clearOnPositionChange }
}
