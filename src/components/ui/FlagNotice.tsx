'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { create } from 'zustand'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import NoticeCard, { noticeActionClass, noticeActionStyle } from '@/components/ui/NoticeCard'

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
          <NoticeCard
            idPrefix="flag-notice"
            modal
            tag="Flagged"
            tint="#ef4444"
            title="We see you"
            body="Good job cheating. Try again next tournament."
            onClose={hide}
            closeRef={closeRef}
            action={
              <Link href="/terms#fair-play" onClick={hide} className={noticeActionClass()} style={noticeActionStyle}>
                Fair play rules
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            }
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
