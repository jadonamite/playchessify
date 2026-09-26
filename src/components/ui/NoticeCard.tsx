'use client'

import type React from 'react'
import { motion, useReducedMotion } from 'framer-motion'

interface NoticeCardProps {
  /** Pill label, top-left. */
  tag: string
  /** Pill + corner-wash colour. */
  tint: string
  title?: string
  body: string
  onClose: () => void
  /** Full-width pill action; the card owns its styling. */
  action?: React.ReactNode
  closeRef?: React.Ref<HTMLButtonElement>
  idPrefix: string
  /** Set when a backdrop blocks the page behind the card. */
  modal?: boolean
}

export function noticeActionClass() {
  return 'mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-full text-[16px] font-semibold transition-transform active:scale-[0.98]'
}

export const noticeActionStyle: React.CSSProperties = {
  background: 'var(--t1)',
  color: 'var(--bg)',
  textDecoration: 'none',
  border: 0,
  cursor: 'pointer',
}

/** Shared card for dialog-style notices (flag notice, Heads up toast). */
export default function NoticeCard({ tag, tint, title, body, onClose, action, closeRef, idPrefix, modal = false }: NoticeCardProps) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      role="dialog"
      aria-modal={modal || undefined}
      aria-labelledby={`${idPrefix}-title`}
      aria-describedby={`${idPrefix}-body`}
      onClick={(e) => e.stopPropagation()}
      initial={reduce ? false : { opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
      transition={{ type: 'spring', damping: 26, stiffness: 320 }}
      className="relative w-full max-w-[340px] overflow-hidden rounded-[32px] border p-6 pointer-events-auto"
      style={{
        background: `radial-gradient(120% 90% at 0% 100%, color-mix(in srgb, ${tint} 10%, transparent), transparent 60%), var(--s2)`,
        borderColor: 'var(--b1)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        fontFamily: 'var(--fb)',
      }}
    >
      <div className="flex items-start justify-between">
        <span
          className="rounded-full px-3 py-1.5 text-[13px] font-semibold"
          style={{ background: `color-mix(in srgb, ${tint} 14%, transparent)`, color: tint }}
        >
          {tag}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 -mt-1 flex h-11 w-11 items-center justify-center rounded-full transition-opacity hover:opacity-80"
          style={{ background: 'var(--s1)', color: 'var(--t1)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {title ? (
        <>
          <h3 id={`${idPrefix}-title`} className="mt-5 text-[20px] font-semibold leading-tight" style={{ color: 'var(--t1)' }}>
            {title}
          </h3>
          <p id={`${idPrefix}-body`} className="mt-2 text-[15px] leading-relaxed" style={{ color: 'var(--t2)' }}>
            {body}
          </p>
        </>
      ) : (
        <p id={`${idPrefix}-body`} className="mt-5 text-[17px] font-semibold leading-snug" style={{ color: 'var(--t1)' }}>
          <span id={`${idPrefix}-title`}>{body}</span>
        </p>
      )}

      {action}
    </motion.div>
  )
}
