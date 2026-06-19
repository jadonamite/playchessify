'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

interface HoldButtonProps {
  /** Fired once the user holds the button to completion. */
  onComplete: () => void
  label: string
  holdingLabel?: string
  /** Hold duration in ms before firing. */
  holdMs?: number
  disabled?: boolean
  loading?: boolean
  loadingLabel?: string
  /** Accent colour for the fill (defaults to the brand cyan). */
  accent?: string
  fullWidth?: boolean
}

/**
 * Press-and-hold confirmation button — same gesture as the in-game hold-to-quit
 * bar, repackaged for reuse (join confirmation, destructive actions, etc.).
 * A battery fill sweeps left→right while held; releasing early cancels.
 */
export default function HoldButton({
  onComplete,
  label,
  holdingLabel = 'Keep holding…',
  holdMs = 1100,
  disabled = false,
  loading = false,
  loadingLabel = 'Confirming…',
  accent = 'var(--c)',
  fullWidth = true,
}: HoldButtonProps) {
  const [holding, setHolding] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fired = useRef(false)

  const clear = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
  }, [])

  const startHold = useCallback(() => {
    if (timer.current || disabled || loading) return
    fired.current = false
    setHolding(true)
    timer.current = setTimeout(() => {
      fired.current = true
      timer.current = null
      setHolding(false)
      onComplete()
    }, holdMs)
  }, [disabled, loading, holdMs, onComplete])

  const cancelHold = useCallback(() => {
    clear()
    if (!fired.current) setHolding(false)
  }, [clear])

  useEffect(() => clear, [clear])

  const inactive = disabled || loading
  const text = loading ? loadingLabel : holding ? holdingLabel : label

  return (
    <motion.button
      type='button'
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      whileTap={inactive ? undefined : { scale: 0.985 }}
      disabled={inactive}
      aria-label={label}
      style={{
        position: 'relative',
        width: fullWidth ? '100%' : undefined,
        height: 54,
        overflow: 'hidden',
        border: 'none',
        borderRadius: 16,
        cursor: inactive ? 'default' : 'pointer',
        background: 'linear-gradient(180deg, #14142a, #0d0d1e)',
        boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${accent} 45%, transparent), 0 6px 0 rgba(0,0,0,.5), 0 10px 26px rgba(0,0,0,.45)`,
        opacity: inactive ? 0.55 : 1,
        touchAction: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* battery fill */}
      <motion.span
        aria-hidden
        initial={false}
        animate={{ scaleX: holding ? 1 : 0 }}
        transition={{ duration: holding ? holdMs / 1000 : 0.16, ease: 'linear' }}
        style={{
          position: 'absolute',
          inset: 0,
          transformOrigin: 'left',
          background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 80%, transparent), ${accent})`,
          zIndex: 0,
        }}
      />
      {/* segment hatching while holding */}
      <span
        aria-hidden
        style={{
          position: 'absolute', inset: 0, zIndex: 1,
          opacity: holding ? 0.4 : 0, transition: 'opacity .15s',
          background: 'repeating-linear-gradient(90deg, transparent 0 22px, rgba(0,0,0,.35) 22px 24px)',
        }}
      />
      {loading && (
        <span
          aria-hidden
          style={{
            position: 'absolute', left: 18, top: '50%', marginTop: -8, zIndex: 2,
            width: 16, height: 16, borderRadius: '50%',
            border: `2px solid ${accent}`, borderTopColor: 'transparent',
            animation: 'spin .6s linear infinite',
          }}
        />
      )}
      <span
        className="relative font-black uppercase"
        style={{
          zIndex: 2,
          fontFamily: 'var(--fd)',
          fontSize: 13,
          letterSpacing: '.08em',
          color: holding ? '#fff' : accent,
        }}
      >
        {text}
      </span>
    </motion.button>
  )
}
