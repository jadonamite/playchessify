'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CoachStore {
  coachId: string | null
  setCoachId: (id: string | null) => void
}

const createCoachStore = () => ({
  coachId: null,
  setCoachId: (id: string | null) => set({ coachId: id }),
})

export const useCoachStore = create<CoachStore>()(
  persist(
    (set) => createCoachStore(),
    { name: 'chessify-coach' },
  ),
)