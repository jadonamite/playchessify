'use client'

import { useToastStore, type ToastType } from '@/hooks/useToastStore'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'

type Config = {
  bg: string
  border: string
  glow: string
  label: string
  labelColor: string
  icon: string
}

const CONFIGS: Record<ToastType, Config> = {
  success: {
    bg: 'linear-gradient(160deg,rgba(6,182,212,.16) 0%,rgba(8,47,73,.55) 100%)',
    border: 'rgba(6,182,212,.45)',
    glow: 'rgba(6,182,212,.3)',
    label: 'CONFIRMED',
    labelColor: '#22d3ee',
    icon: '✓',
  },
  error: {
    bg: 'linear-gradient(160deg,rgba(220,38,38,.16) 0%,rgba(127,29,29,.55) 100%)',
    border: 'rgba(220,38,38,.45)',
    glow: 'rgba(220,38,38,.3)',
    label: 'ERROR',
    labelColor: '#ef4444',
    icon: '✕',
  },
  info: {
    bg: 'linear-gradient(160deg,rgba(99,102,241,.14) 0%,rgba(30,27,75,.55) 100%)',
    border: 'rgba(99,102,241,.4)',
    glow: 'rgba(99,102,241,.26)',
    label: 'INFO',
    labelColor: '#818cf8',
    icon: 'i',
  },
  invalid: {
    bg: 'linear-gradient(160deg,rgba(245,158,11,.14) 0%,rgba(78,49,10,.55) 100%)',
    border: 'rgba(245,158,11,.45)',
    glow: 'rgba(245,158,11,.26)',
    label: 'ILLEGAL MOVE',
    labelColor: '#fbbf24',
    icon: '⚠',
  },
  check: {
    bg: 'linear-gradient(160deg,rgba(239,68,68,.2) 0%,rgba(88,28,28,.6) 100%)',
    border: 'rgba(239,68,68,.55)',
    glow: 'rgba(239,68,68,.4)',
    label: 'KING IN CHECK',
    labelColor: '#f87171',
    icon: '♚',
  },
  checkmate: {
    bg: 'linear-gradient(160deg,rgba(109,40,217,.24) 0%,rgba(20,5,40,.72) 100%)',
    border: 'rgba(139,92,246,.55)',
    glow: 'rgba(139,92,246,.45)',
    label: 'CHECKMATE',
    labelColor: '#a78bfa',
    icon: '♛',
  },
  draw: {
    bg: 'linear-gradient(160deg,rgba(0,204,255,.12) 0%,rgba(8,47,73,.55) 100%)',
    border: 'rgba(0,204,255,.4)',
    glow: 'rgba(0,204,255,.26)',
    label: 'DRAW',
    labelColor: '#22d3ee',
    icon: '♟',
  },
}

export default function CenterToast() {
  const { toast, hideToast } = useToastStore()
  const duration = toast?.duration ?? 4000

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(hideToast, duration)
    return () => clearTimeout(t)
  }, [toast, hideToast, duration])

  const cfg = toast ? CONFIGS[toast.type] : null

  return (
    <AnimatePresence>
      {toast && cfg && (
        <div className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center px-4">
          <motion.div
            key={toast.type + toast.message}
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.94 }}
            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
            className="pointer-events-auto w-full max-w-[300px]"
          >
            <div
              className="relative flex flex-col items-center gap-2.5 rounded-3xl border px-7 pt-7 pb-6 text-center backdrop-blur-xl overflow-hidden"
              style={{
                background: cfg.bg,
                borderColor: cfg.border,
                boxShadow: `0 0 40px ${cfg.glow}, 0 24px 48px rgba(0,0,0,0.55)`,
              }}
            >
              {/* Dismiss */}
              <button
                onClick={hideToast}
                className="absolute right-3 top-3 rounded-lg p-1.5 text-white/25 transition-colors hover:bg-white/5 hover:text-white/60"
                aria-label="Dismiss"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>

              {/* Icon bubble */}
              <motion.div
                initial={{ scale: 0.5, rotate: -8 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 12, stiffness: 300, delay: 0.05 }}
                className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-black"
                style={{
                  background: `radial-gradient(circle at 30% 25%, ${cfg.glow}, transparent 75%)`,
                  border: `1.5px solid ${cfg.border}`,
                  color: cfg.labelColor,
                  boxShadow: `0 6px 18px ${cfg.glow}, inset 0 1px 0 rgba(255,255,255,0.15)`,
                }}
              >
                {cfg.icon}
              </motion.div>

              {/* Label */}
              <span
                className="text-[10px] font-black uppercase tracking-[0.28em]"
                style={{ color: cfg.labelColor, fontFamily: 'var(--fd)' }}
              >
                {cfg.label}
              </span>

              {/* Message */}
              <p className="text-[13px] font-semibold leading-snug text-gray-100">
                {toast.message}
              </p>

              {/* Auto-dismiss timer bar */}
              <motion.div
                key={toast.type + toast.message + '-bar'}
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: duration / 1000, ease: 'linear' }}
                className="absolute bottom-0 left-0 h-1 w-full origin-left"
                style={{ background: cfg.labelColor, opacity: 0.55 }}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
