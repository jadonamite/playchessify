'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ChessProfile } from '@/types/profile'
import ChessAvatar from '@/components/ui/ChessAvatar'
import ChessName from '@/components/ui/ChessName'
import { usePlayerStats } from '@/hooks/usePlayerStats'
import { useToastStore } from '@/hooks/useToastStore'

// ... (unchanged code)

function getSideStyles(color: Color) {
  const accent = color === 'white' ? 'var(--c)' : 'var(--candy-grape)'
  const tint = color === 'white'
    ? 'radial-gradient(circle at 50% 32%, color-mix(in srgb, var(--c) 15%, transparent), transparent 70%)'
    : 'radial-gradient(circle at 50% 68%, color-mix(in srgb, var(--candy-grape) 17%, transparent), transparent 70%)'

  return { accent, tint }
}

/* ── one side of the split — player / bot / searching ── */
function Side({
  mode, address, color, isMe, botLabel, profileMap, slide, order,
}: {
  mode: SideMode
  address: string
  color: Color
  isMe: boolean
  botLabel?: string
  profileMap: Record<string, ChessProfile | null>
  slide: { x?: number; y?: number }
  order: string
}) {
  const { accent, tint } = getSideStyles(color)
  // ... (unchanged code)
}

// ... (unchanged code)
