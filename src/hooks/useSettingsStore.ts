'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type BoardTheme = 'dark' | 'forest' | 'classic' | 'midnight'

export const BOARD_THEMES: Record<BoardTheme, { dark: string; light: string; name: string }> = {
  dark: { dark: '#0f172a', light: '#1e293b', name: 'Dark (Default)' },
  forest: { dark: '#1a3a2a', light: '#2d5a3d', name: 'Forest' },
  classic: { dark: '#b58863', light: '#f0d9b5', name: 'Classic' },
  midnight: { dark: '#1a0a2e', light: '#2d1b54', name: 'Midnight' },
}

export type AiDifficulty = 'easy' | 'medium' | 'hard'

// Difficulty maps to minimax search depth. Capped at 3 — deeper search
// gets sluggish in-browser.
export const AI_DEPTH: Record<AiDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
}

export const AI_DIFFICULTY_LABELS: Record<AiDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

interface SettingsState {
  soundEnabled: boolean
  boardTheme: BoardTheme
  aiDifficulty: AiDifficulty
  showMoveHints: boolean
  setSoundEnabled: (v: boolean) => void
  setBoardTheme: (t: BoardTheme) => void
  setAiDifficulty: (d: AiDifficulty) => void
  setShowMoveHints: (v: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      boardTheme: 'dark',
      aiDifficulty: 'medium',
      showMoveHints: true,
      setSoundEnabled: (v) => set({ soundEnabled: v }),
      setBoardTheme: (t) => set({ boardTheme: t }),
      setAiDifficulty: (d) => set({ aiDifficulty: d }),
      setShowMoveHints: (v) => set({ showMoveHints: v }),
    }),
    { name: 'chessify-settings' },
  ),
)
