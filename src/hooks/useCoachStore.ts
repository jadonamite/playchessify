'use client'

import { persist } from 'zustand/middleware'
import { create } from 'zustand'

/**
 * UI cache of the player's active coach id, persisted to localStorage so the
 * nav + lobby render the right coach face instantly — no API round-trip, no
 * signature. The learner model (server) remains the source of truth for
 * training content; this mirrors it for chrome that renders everywhere.
 *
 * Set it wherever a coach is chosen (landing, intro, hub) and sync it from the
 * learner model when that loads.
 */
interface CoachStore {
  coachId: string | null
  setCoachId: (id: string | null) => void
}

export const useCoachStore = create<CoachStore>()(
  persist(
    (set) => ({
      coachId: null,
      setCoachId: (id) => set({ coachId: id }),
    }),
    { name: 'chessify-coach' },
  ),
)
