'use client'

import { useToastStore, type ToastType } from '@/hooks/useToastStore'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'
import {
  CheckCircleIcon, CloseCircleIcon, InfoCircleIcon, DangerTriangleIcon,
  DrawIcon, CrownIcon, RankIcon, type IconProps,
} from '@/components/ui/icons'

type Config = {
  /** Solid-leaning card fill — owns its color instead of a translucent chip. */
  bg: string
  border: string
  glow: string
  accent: string
  headline: string
  Icon: (p: IconProps) => React.ReactElement
  /** Set only on toasts that hold the screen — gives them a real CTA instead
   *  of just an auto-dismiss bar, matching how a claimed win or a lost claim
   *  should actually feel to close out. */
  buttonLabel?: string
}

const CONFIGS: Record<ToastType, Config> = {
  success: {
    bg: 'linear-gradient(165deg,#0d3038 0%,#051217 62%,#030a0d 100%)',
    border: 'rgba(34,211,238,.5)',
    glow: 'rgba(34,211,238,.35)',
    accent: '#22d3ee',
    headline: 'Nice one!',
    Icon: CheckCircleIcon,
    buttonLabel: 'GREAT',
  },
  error: {
    bg: 'linear-gradient(165deg,#3a0f0f 0%,#1a0707 62%,#0d0303 100%)',
    border: 'rgba(248,113,113,.5)',
    glow: 'rgba(239,68,68,.35)',
    accent: '#f87171',
    headline: 'Something went wrong',
    Icon: CloseCircleIcon,
    buttonLabel: 'TRY AGAIN',
  },
  info: {
    bg: 'linear-gradient(165deg,#161642 0%,#0a0a24 62%,#050512 100%)',
    border: 'rgba(129,140,248,.5)',
    glow: 'rgba(99,102,241,.35)',
    accent: '#a5b4fc',
    headline: 'Heads up',
    Icon: InfoCircleIcon,
    buttonLabel: 'GOT IT',
  },
  invalid: {
    bg: 'linear-gradient(160deg,rgba(245,158,11,.16) 0%,rgba(60,38,8,.6) 100%)',
    border: 'rgba(245,158,11,.45)',
    glow: 'rgba(245,158,11,.28)',
    accent: '#fbbf24',
    headline: 'Illegal move',
    Icon: DangerTriangleIcon,
  },
  check: {
    bg: 'linear-gradient(160deg,rgba(239,68,68,.2) 0%,rgba(60,15,15,.62) 100%)',
    border: 'rgba(248,113,113,.5)',
    glow: 'rgba(239,68,68,.35)',
    accent: '#f87171',
    headline: 'Check!',
    Icon: CrownIcon,
  },
  checkmate: {
    bg: 'linear-gradient(165deg,#28104e 0%,#150726 62%,#0a0313 100%)',
    border: 'rgba(167,139,250,.55)',
    glow: 'rgba(139,92,246,.45)',
    accent: '#c4b5fd',
    headline: 'Checkmate!',
    Icon: RankIcon,
    buttonLabel: 'CONTINUE',
  },
  draw: {
    bg: 'linear-gradient(165deg,#0c2a38 0%,#061318 62%,#030a0d 100%)',
    border: 'rgba(34,211,238,.45)',
    glow: 'rgba(34,211,238,.3)',
    accent: '#67e8f9',
    headline: "It's a draw",
    Icon: DrawIcon,
    buttonLabel: 'CONTINUE',
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

  // A mispress toast must never stand between the player and the board: let
  // clicks fall straight through it, and drop the CTA/dismiss (there is
  // nothing to dismiss when it isn't in the way).
  const blocking = toast ? toast.type !== 'invalid' && toast.type !== 'check' : false

  return (
    <AnimatePresence>
      {toast && cfg && (
        <div className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center px-4">
          <motion.div
            key={toast.type + toast.message}
            initial={{ opacity: 0, y: 12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
            className={`w-full ${blocking ? 'max-w-[360px] pointer-events-auto' : 'max-w-[280px] pointer-events-none'}`}
          >
            <div
              className={`relative flex flex-col items-center text-center overflow-hidden rounded-[28px] border ${blocking ? 'gap-4 px-8 pt-9 pb-8' : 'gap-2 px-6 pt-6 pb-5 rounded-3xl'}`}
              style={{
                background: cfg.bg,
                borderColor: cfg.border,
                boxShadow: `0 0 60px ${cfg.glow}, 0 30px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)`,
              }}
            >
              {/* Ambient glow wash behind the icon — depth without translucency */}
              <div
                aria-hidden
                className="absolute -top-10 left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
                style={{ width: 220, height: 220, background: `radial-gradient(circle, ${cfg.glow}, transparent 70%)`, opacity: 0.6 }}
              />

              {/* Dismiss — only on toasts that actually hold the screen */}
              {blocking && (
                <button
                  onClick={hideToast}
                  className="absolute right-4 top-4 rounded-lg p-1.5 text-white/25 transition-colors hover:bg-white/10 hover:text-white/70 z-10"
                  aria-label="Dismiss"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}

              {/* Icon badge */}
              <motion.div
                initial={{ scale: 0.4, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 11, stiffness: 260, delay: 0.06 }}
                className="relative z-10 flex items-center justify-center rounded-full"
                style={{
                  width: blocking ? 88 : 52,
                  height: blocking ? 88 : 52,
                  background: `radial-gradient(circle at 32% 28%, ${cfg.glow}, transparent 72%)`,
                  border: `1.5px solid ${cfg.border}`,
                  color: cfg.accent,
                  boxShadow: `0 8px 24px ${cfg.glow}, inset 0 1px 0 rgba(255,255,255,0.18)`,
                }}
              >
                <cfg.Icon size={blocking ? 46 : 28} />
              </motion.div>

              {/* Headline */}
              <h3
                className={`relative z-10 font-black leading-tight ${blocking ? 'text-xl' : 'text-sm'}`}
                style={{ color: '#f8fafc', fontFamily: 'var(--fd)' }}
              >
                {cfg.headline}
              </h3>

              {/* Message */}
              <p className={`relative z-10 leading-snug text-gray-300 ${blocking ? 'text-[13px]' : 'text-[11px] font-semibold'}`}>
                {toast.message}
              </p>

              {/* CTA — blocking toasts only */}
              {blocking && cfg.buttonLabel && (
                <button
                  onClick={hideToast}
                  className="relative z-10 mt-1 w-full rounded-full py-3 text-[12px] font-black tracking-[0.12em] transition-transform active:scale-[0.98]"
                  style={{
                    fontFamily: 'var(--fd)',
                    color: '#04070e',
                    background: `linear-gradient(180deg, ${cfg.accent}, ${cfg.accent})`,
                    boxShadow: `0 10px 26px ${cfg.glow}`,
                  }}
                >
                  {cfg.buttonLabel}
                </button>
              )}

              {/* Auto-dismiss timer — non-blocking toasts only (blocking ones close via the CTA) */}
              {!blocking && (
                <motion.div
                  key={toast.type + toast.message + '-bar'}
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: duration / 1000, ease: 'linear' }}
                  className="absolute bottom-0 left-0 h-1 w-full origin-left"
                  style={{ background: cfg.accent, opacity: 0.55 }}
                />
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
