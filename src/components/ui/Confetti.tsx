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
  className?: string,
}

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
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * (isBurst ? 0.2 : 2),
      duration: (isBurst ? 0.9 : 2) + Math.random() * (isBurst ? 1 : 3),
      size: 4 + Math.random() * 7,
      color: colors[Math.floor(Math.random() * colors.length)],
      spin: 360 + Math.random() * 540,
      angle: Math.random() * Math.PI * 2,
      dist: 130 + Math.random() * 230,
    })),
  )

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`} aria-hidden>
      {pieces.map((p) => {
        const base = {
          position: 'absolute' as const,
          width: p.size,
          height: p.size,
          borderRadius: p.size > 7.5 ? 2 : '50%',
          background: p.color,
        }
        return isBurst ? (
          <motion.div
            key={p.id}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{ x: Math.cos(p.angle) * p.dist, y: Math.sin(p.angle) * p.dist, opacity: 0, rotate: p.spin }}
            transition={{ duration: p.duration, delay: p.delay, ease: 'easeOut' }}
            style={{ ...base, left: '50%', top: '45%' }}
          />
        ) : (
          <motion.div
            key={p.id}
            initial={{ y: '-10vh', opacity: 1, rotate: 0 }}
            animate={{ y: '110vh', opacity: 0, rotate: p.spin }}
            transition={{ duration: p.duration, delay: p.delay, ease: 'linear', repeat: Infinity }}
            style={{ ...base, left: `${p.left}%`, top: 0 }}
          />
        )
      })}
    </div>
  )
}
