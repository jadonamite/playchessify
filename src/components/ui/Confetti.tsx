'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

/**
 * Self-contained confetti (no global keyframes). Two variants:
 *  - `fall`  → particles rain down and loop (ambient celebration, e.g. faucet success)
 *  - `burst` → a one-shot radial explosion from the centre (streak celebration)
 *
 * Replaces the old inline confetti that lived in FaucetResultModal.
 */

const PALETTES = {
  brand: ['#00ccff', '#6a0dad', '#35ee66', '#ffb400', '#ff4466'],
  flame: ['#ffb74d', '#ff7a18', '#ff4466', '#ffd27a', '#ff9a3d', '#ffe08a'],
} as const

interface ConfettiProps {
  count?: number
  palette?: keyof typeof PALETTES
  variant?: 'fall' | 'burst'
  className?: string
}

const generateConfettiPiece = (id: number, isBurst: boolean, colors: string[], count: number) => ({
  id,
  left: Math.random() * 100,
  delay: Math.random() * (isBurst ? 0.2 : 2),
  duration: (isBurst ? 0.9 : 2) + Math.random() * (isBurst ? 1 : 3),
  size: 4 + Math.random() * 7,
  color: colors[Math.floor(Math.random() * colors.length)],
  spin: 360 + Math.random() * 540,
  angle: Math.random() * Math.PI * 2,
  dist: 130 + Math.random() * 230,
})

const getBaseStyle = (piece: any) => ({
  position: 'absolute' as const,
  width: piece.size,
  height: piece.size,
  borderRadius: piece.size > 7.5 ? 2 : '50%',
  background: piece.color,
})

export default function Confetti({
  count = 28,
  palette = 'brand',
  variant = 'fall',
  className = '',
}: ConfettiProps) {
  const colors = PALETTES[palette]
  const isBurst = variant === 'burst'

  // Generate once via lazy initial state — particles stay stable across re-renders.
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => generateConfettiPiece(i, isBurst, colors, count))
  )

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`} aria-hidden>
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: isBurst ? 0 : '-10vh', y: isBurst ? 0 : '-10vh', opacity: 1, rotate: 0 }}
          animate={{
            x: isBurst ? Math.cos(p.angle) * p.dist : '110vh',
            y: isBurst ? Math.sin(p.angle) * p.dist : '110vh',
            opacity: 0,
            rotate: p.spin
          }}
          transition={{ duration: p.duration, delay: p.delay, ease: isBurst ? 'easeOut' : 'linear', repeat: isBurst ? undefined : Infinity }}
          style={{ ...getBaseStyle(p), left: isBurst ? '50%' : `${p.left}%`, top: isBurst ? '45%' : 0 }}
        />
      ))}
    </div>
  )
}
