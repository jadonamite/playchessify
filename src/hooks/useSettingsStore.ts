'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type BoardTheme = 'dark' | 'forest' | 'classic' | 'midnight'

export const getBoardThemes = (): Record<BoardTheme, { dark: string; light: string; name: string }> => ({
  dark: { dark: '#0f172a', light: '#1e293b', name: 'Dark (Default)' },
  forest: { dark: '#1a3a2a', light: '#2d5a3d', name: 'Forest' },
  classic: { dark: '#b58863', light: '#f0d9b5', name: 'Classic' },
  midnight: { dark: '#1a0a2e', light: '#2d1b54', name: 'Midnight' },
})

export type PieceSet = 'chessnut' | 'caliente' | 'maestro' | 'fresca' | 'cooke'

export const getPieceSets = (): { id: PieceSet; name: string }[] => ([
  { id: 'chessnut', name: 'Chessnut' },
  { id: 'caliente', name: 'Caliente' },
  { id: 'maestro', name: 'Maestro' },
  { id: 'fresca', name: 'Fresca' },
  { id: 'cooke', name: 'Cooke' },
])

export type AiDifficulty = 'easy' | 'medium' | 'hard'

export const getAiDepth = (difficulty: AiDifficulty): number => ({
  easy: 1,
  medium: 2,
  hard: 3,
}[difficulty])

export const getAiDifficultyLabels = (difficulty: AiDifficulty): string => ({
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}[difficulty])

interface SettingsState {
  soundEnabled: boolean
  boardTheme: BoardTheme
  pieceSet: PieceSet
  aiDifficulty: AiDifficulty
  showMoveHints: boolean
  setSoundEnabled: (v: boolean) => void
  setBoardTheme: (t: BoardTheme) => void
  setPieceSet: (p: PieceSet) => void
  setAiDifficulty: (d: AiDifficulty) => void
  setShowMoveHints: (v: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      boardTheme: 'dark',
      pieceSet: 'chessnut',
      aiDifficulty: 'medium',
      showMoveHints: true,
      setSoundEnabled: (v) => set({ soundEnabled: v }),
      setBoardTheme: (t) => set({ boardTheme: t }),
      setPieceSet: (p) => set({ pieceSet: p }),
      setAiDifficulty: (d) => set({ aiDifficulty: d }),
      setShowMoveHints: (v) => set({ showMoveHints: v }),
    }),
    { name: 'chessify-settings' },
  ),
)