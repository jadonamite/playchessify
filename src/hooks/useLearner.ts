'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSignMessage } from 'wagmi'
import { useWallet } from '@/components/wallet-provider'
import type { Concept, LearnerLevel, LearnerModel } from '@/types/training'

/**
 * Client access to the learner model. GET is open; updates are signed with the
 * player's wallet (same anti-replay pattern as profile updates). All chess
 * truth still comes from the engine — this only persists progress.
 */
export function useLearner() {
  const { playerAddress } = useWallet()
  const { signMessageAsync } = useSignMessage()
  const [learner, setLearner] = useState<LearnerModel | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!playerAddress) return
    setLoading(true)
    try {
      const res = await fetch(`/api/train/${playerAddress}`, { cache: 'no-store' })
      if (res.ok) setLearner((await res.json()).learner)
    } finally {
      setLoading(false)
    }
  }, [playerAddress])

  useEffect(() => { void refresh() }, [refresh])

  const update = useCallback(
    async (patch: {
      coachId?: string
      level?: LearnerLevel
      placed?: boolean
      concepts?: Partial<Record<Concept, number>>
      completedLesson?: string
    }): Promise<LearnerModel | null> => {
      if (!playerAddress) return null
      const timestamp = new Date().toISOString()
      const message = `Chessify Training Update\n\nAddress: ${playerAddress.toLowerCase()}\nTimestamp: ${timestamp}`
      const signature = await signMessageAsync({ message })
      const res = await fetch(`/api/train/${playerAddress}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...patch, signature, timestamp }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'update failed')
      const next = (await res.json()).learner as LearnerModel
      setLearner(next)
      return next
    },
    [playerAddress, signMessageAsync],
  )

  return { learner, loading, refresh, update }
}
