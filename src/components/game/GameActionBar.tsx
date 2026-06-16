'use client'

import { useCallback, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { HintBulbIcon } from '@/components/ui/icons'

interface GameActionBarProps {
  hintDisabled: boolean
  isHintLoading: boolean
  onHint: () => void
  onNewGame: () => void
  /** Fired only after the user holds the Quit button to completion. */
  onQuit: () => void
  /** Label hint: PvP active matches forfeit on quit. */
  quitForfeits: boolean
}

const HOLD_MS = 1000

function NewGameGlyph({ size = 23 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      {/* duotone refresh: ring (secondary) + arrowhead (primary) */}
      <path fillOpacity={0.32} d="M12 4a8 8 0 1 0 7.5 5.3 1 1 0 0 0-1.9.7A6 6 0 1 1 12 6V4z" />
      <path d="M12 1.5 16 4l-4 2.5v-5z" />
    </svg>
  )
}

function QuitGlyph({ size = 23 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      {/* duotone power/exit: ring (secondary) + bar (primary) */}
      <path fillOpacity={0.32} d="M5.5 8.5a8 8 0 1 0 13 0 1 1 0 0 0-1.6 1.2 6 6 0 1 1-9.8 0A1 1 0 0 0 5.5 8.5z" />
      <rect x="11" y="2.5" width="2" height="8.5" rx="1" />
    </svg>
  )
}

function Cell({
  children,
  accent,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  accent: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.93 }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="relative flex flex-1 flex-col items-center justify-center gap-1 select-none"
      style={{
        background: 'transparent',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        color: accent,
        WebkitTapHighlightColor: 'transparent',
        paddingTop: 9,
      }}
    >
      {children}
    </motion.button>
  )
}

const LABEL: React.CSSProperties = {
  fontFamily: 'var(--fd)',
  fontSize: 8.5,
  fontWeight: 700,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
}

export default function GameActionBar({
  hintDisabled,
  isHintLoading,
  onHint,
  onNewGame,
  onQuit,
  quitForfeits,
}: GameActionBarProps) {
  const [holding, setHolding] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fired = useRef(false)

  const startHold = useCallback(() => {
    if (timer.current) return
    fired.current = false
    setHolding(true)
    timer.current = setTimeout(() => {
      fired.current = true
      timer.current = null
      setHolding(false)
      onQuit()
    }, HOLD_MS)
  }, [onQuit])

  const cancelHold = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (!fired.current) setHolding(false)
  }, [])

  const dangerColor = '#f87171'

  return (
    <nav
      className="pc-bottom-nav"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 60,
        alignItems: 'stretch',
        height: 'calc(var(--bottom-nav-h) + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'var(--bottom-nav-bg)',
        borderTop: '1px solid var(--bottom-nav-border)',
        boxShadow: 'var(--bottom-nav-shadow)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Hint — glowing bulb */}
      <Cell accent="var(--candy-amber)" onClick={onHint} disabled={hintDisabled || isHintLoading}>
        <span className="flex">
          <HintBulbIcon size={23} glow={!hintDisabled && !isHintLoading} />
        </span>
        <span style={{ ...LABEL, color: hintDisabled ? 'var(--t3)' : 'var(--t1)' }}>
          {isHintLoading ? '…' : 'Hint'}
        </span>
      </Cell>

      {/* New Game */}
      <Cell accent="var(--candy-lime)" onClick={onNewGame}>
        <span className="flex"><NewGameGlyph /></span>
        <span style={{ ...LABEL, color: 'var(--t1)' }}>New</span>
      </Cell>

      {/* Quit — hold to confirm */}
      <motion.button
        type="button"
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        whileTap={{ scale: 0.96 }}
        className="relative flex flex-1 flex-col items-center justify-center gap-1 select-none overflow-hidden"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: dangerColor,
          WebkitTapHighlightColor: 'transparent',
          paddingTop: 9,
          touchAction: 'none',
        }}
        aria-label={quitForfeits ? 'Hold to resign and quit' : 'Hold to quit'}
      >
        {/* hold-fill that rises from the bottom */}
        <motion.span
          aria-hidden
          initial={false}
          animate={{ scaleY: holding ? 1 : 0 }}
          transition={{ duration: holding ? HOLD_MS / 1000 : 0.18, ease: 'linear' }}
          style={{
            position: 'absolute',
            inset: 0,
            transformOrigin: 'bottom',
            background: `color-mix(in srgb, ${dangerColor} 24%, transparent)`,
            zIndex: 0,
          }}
        />
        <span className="relative z-[1] flex"><QuitGlyph /></span>
        <span className="relative z-[1]" style={{ ...LABEL, color: holding ? dangerColor : 'var(--t1)' }}>
          {holding ? 'Hold…' : 'Quit'}
        </span>
      </motion.button>
    </nav>
  )
}
