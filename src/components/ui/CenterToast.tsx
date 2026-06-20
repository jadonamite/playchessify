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
  position: 'center' | 'bottom'
}

const CONFIGS: Record<ToastType, Config> = {
  success: {
    bg: 'linear-gradient(135deg,rgba(6,182,212,.15) 0%,rgba(8,47,73,.5) 100%)',
    border: 'rgba(6,182,212,.4)',
    glow: 'rgba(6,182,212,.25)',
    label: 'CONFIRMED',
    labelColor: '#22d3ee',
    icon: '✓',
    position: 'center',
  },
  error: {
    bg: 'linear-gradient(135deg,rgba(220,38,38,.15) 0%,rgba(127,29,29,.5) 100%)',
    border: 'rgba(220,38,38,.4)',
    glow: 'rgba(220,38,38,.25)',
    label: 'ERROR',
    labelColor: '#ef4444',
    icon: '✕',
    position: 'center',
  },
  info: {
    bg: 'linear-gradient(135deg,rgba(99,102,241,.12) 0%,rgba(30,27,75,.5) 100%)',
    border: 'rgba(99,102,241,.35)',
    glow: 'rgba(99,102,241,.2)',
    label: 'INFO',
    labelColor: '#818cf8',
    icon: 'i',
    position: 'center',
  },
  invalid: {
    bg: 'linear-gradient(135deg,rgba(245,158,11,.12) 0%,rgba(78,49,10,.5) 100%)',
    border: 'rgba(245,158,11,.4)',
    glow: 'rgba(245,158,11,.2)',
    label: '⚠ ILLEGAL MOVE',
    labelColor: '#fbbf24',
    icon: '⚠',
    position: 'bottom',
  },
  check: {
    bg: 'linear-gradient(135deg,rgba(239,68,68,.18) 0%,rgba(88,28,28,.6) 100%)',
    border: 'rgba(239,68,68,.55)',
    glow: 'rgba(239,68,68,.35)',
    label: '⚔ KING IN CHECK',
    labelColor: '#f87171',
    icon: '♚',
    position: 'bottom',
  },
  checkmate: {
    bg: 'linear-gradient(135deg,rgba(109,40,217,.22) 0%,rgba(20,5,40,.7) 100%)',
    border: 'rgba(139,92,246,.55)',
    glow: 'rgba(109,40,217,.4)',
    label: '☠ CHECKMATE',
    labelColor: '#a78bfa',
    icon: '♛',
    position: 'bottom',
  },
  draw: {
    bg: 'linear-gradient(135deg,rgba(0,204,255,.1) 0%,rgba(8,47,73,.5) 100%)',
    border: 'rgba(0,204,255,.35)',
    glow: 'rgba(0,204,255,.2)',
    label: '🤝 DRAW',
    labelColor: '#22d3ee',
    icon: '♟',
    position: 'bottom',
  },
}

export default function CenterToast() {
  const { toast, hideToast } = useToastStore()

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(hideToast, toast.duration ?? 4000)
    return () => clearTimeout(t)
  }, [toast, hideToast])

  const cfg = toast ? CONFIGS[toast.type] : null
  const isBottom = cfg?.position === 'bottom'

  return (
    <AnimatePresence>
      {toast && cfg && (
        <div
          className="fixed inset-0 pointer-events-none z-[9999] flex justify-center"
          style={{ alignItems: isBottom ? 'flex-end' : 'center', paddingBottom: isBottom ? '1.5rem' : 0 }}
        >
          <motion.div
            key={toast.type + toast.message}
            initial={{ opacity: 0, y: isBottom ? 24 : 0, scale: isBottom ? 0.97 : 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isBottom ? 12 : -12, scale: 0.95 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            className="pointer-events-auto mx-4 w-full max-w-sm"
          >
            <div
              className="rounded-2xl border backdrop-blur-xl shadow-2xl overflow-hidden flex items-center gap-4 px-5 py-4"
              style={{
                background: cfg.bg,
                borderColor: cfg.border,
                boxShadow: `0 0 32px ${cfg.glow}, 0 20px 40px rgba(0,0,0,0.5)`,
              }}
            >
              {/* Icon bubble */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shrink-0"
                style={{ background: `${cfg.glow}`, border: `1px solid ${cfg.border}`, color: cfg.labelColor }}
              >
                {cfg.icon}
              </div>

              {/* Text */}
              <div className="flex flex-col flex-1 min-w-0">
                <span
                  className="text-[9px] font-black tracking-[0.25em] uppercase mb-0.5"
                  style={{ color: cfg.labelColor, fontFamily: 'var(--fd)' }}
                >
                  {cfg.label}
                </span>
                <p className="text-[12px] font-semibold text-gray-100 leading-snug truncate">
                  {toast.message}
                </p>
              </div>

              {/* Dismiss */}
              <button
                onClick={hideToast}
                className="shrink-0 p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors"
                aria-label="Dismiss"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
