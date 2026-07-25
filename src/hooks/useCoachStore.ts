'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CoachStore {
  coachId: string | null
  setCoachId: (id: string | null) => void
}

const getInitialCoachState = () => ({
  coachId: null,
})

const createSetCoachId = (set: (state: CoachStore) => void) => (id: string | null) => set({ coachId: id })

export const useCoachStore = create<CoachStore>()(
  persist(
    (set) => ({
      ...getInitialCoachState(),
      setCoachId: createSetCoachId(set),
    }),
    { name: 'chessify-coach' },
  ),
)