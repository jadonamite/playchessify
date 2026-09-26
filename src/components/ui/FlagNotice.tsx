'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { create } from 'zustand'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

interface FlagNoticeState {
  open: boolean
  show: () => void
  hide: () => void
}

export const useFlagNotice = create<FlagNoticeState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}))

const FLAG_RED = '#ef4444'

export default function FlagNotice() {
  const { open, hide } = useFlagNotice()
  const reduce = useReducedMotion()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, hide])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="flag-notice"
          className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
          onClick={hide}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="flag-notice-title"
            aria-describedby="flag-notice-body"
            onClick={(e) => e.stopPropagation()}
            initial={reduce ? false : { opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="relative w-full max-w-[340px] overflow-hidden rounded-[32px] border p-6"
            style={{
              background: `radial-gradient(120% 90% at 0% 100%, rgba(239,68,68,0.10), transparent 60%), var(--s2)`,
              borderColor: 'var(--b1)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
              fontFamily: 'var(--fb)',
            }}
          >
            <div className="flex items-start justify-between">
              <span
                className="rounded-full px-3 py-1.5 text-[13px] font-semibold"
                style={{ background: 'rgba(239,68,68,0.14)', color: FLAG_RED }}
              >
                Flagged
              </span>
              <button
                ref={closeRef}
                type="button"
                onClick={hide}
                aria-label="Close"
                className="-mr-1 -mt-1 flex h-11 w-11 items-center justify-center rounded-full transition-opacity hover:opacity-80"
                style={{ background: 'var(--s1)', color: 'var(--t1)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <h3
              id="flag-notice-title"
              className="mt-5 text-[20px] font-semibold leading-tight"
              style={{ color: 'var(--t1)' }}
            >
              We see you
            </h3>
            <p
              id="flag-notice-body"
              className="mt-2 text-[15px] leading-relaxed"
              style={{ color: 'var(--t2)' }}
            >
              Good job cheating. Try again next tournament.
            </p>

            <Link
              href="/terms#fair-play"
              onClick={hide}
              className="mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-full text-[16px] font-semibold transition-transform active:scale-[0.98]"
              style={{ background: 'var(--t1)', color: 'var(--bg)', textDecoration: 'none' }}
            >
              Fair play rules
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
