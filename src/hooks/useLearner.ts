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

  const fetchLearner = useCallback(async () => {
    if (!playerAddress) return null
    const res = await fetch(`/api/train/${playerAddress}`, { cache: 'no-store' })
    if (res.ok) return (await res.json()).learner
    return null
  }, [playerAddress])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const learner = await fetchLearner()
      setLearner(learner)
    } finally {
      setLoading(false)
    }
  }, [fetchLearner])

  useEffect(() => { void refresh() }, [refresh])

  const updateLearner = useCallback(
    async (patch: {
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
      const next = (await res.json()).learner as LearnerModel
      setLearner(next)
      return next
    },
    [playerAddress],
  )

  return { learner, loading, refresh, update: updateLearner }
}