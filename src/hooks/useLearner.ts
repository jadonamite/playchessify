'use client'

import { useCallback, useEffect, useState } from 'react'
import { useWallet } from '@/components/wallet-provider'
import type { Concept, LearnerLevel, LearnerModel } from '@/types/training'

/**
 * Client access to the learner model. Training progress is low-stakes, so
 * updates are NOT wallet-signed — switching coaches or saving a drill is
 * instant, no popup. All chess truth still comes from the engine; this only
 * persists progress keyed by address.
 */
export function useLearner() {
  const { playerAddress } = useWallet()
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

  const updateLearnerModel = async (patch: {
    coachId?: string
    level?: LearnerLevel
    placed?: boolean
    concepts?: Partial<Record<Concept, number>>
    completedLesson?: string
  }): Promise<LearnerModel | null> => {
    if (!playerAddress) return null
    const res = await fetch(`/api/train/${playerAddress}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'update failed')
    return (await res.json()).learner as LearnerModel
  }

  const update = useCallback(
    async (patch: {
      coachId?: string
      level?: LearnerLevel
      placed?: boolean
      concepts?: Partial<Record<Concept, number>>
      completedLesson?: string
    }): Promise<LearnerModel | null> => {
      const next = await updateLearnerModel(patch)
      setLearner(next)
      return next
    },
    [playerAddress, updateLearnerModel]
  )

  return { learner, loading, refresh, update }
}