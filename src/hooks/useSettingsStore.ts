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

interface SettingsState {
  soundEnabled: boolean
  boardTheme: BoardTheme
  setSoundEnabled: (v: boolean) => void
  setBoardTheme: (t: BoardTheme) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      boardTheme: 'dark',
      setSoundEnabled: (v) => set({ soundEnabled: v }),
      setBoardTheme: (t) => set({ boardTheme: t }),
    }),
    { name: 'chessify-settings' },
  ),
)
