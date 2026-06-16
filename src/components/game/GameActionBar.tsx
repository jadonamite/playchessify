'use client'

import { useCallback, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { HintBulbIcon } from '@/components/ui/icons'

interface GameActionBarProps {
  gameOver: boolean
  /** Active PvP wager match — quitting forfeits the wager (resign). */
  quitForfeits: boolean
  hintDisabled: boolean
  isHintLoading: boolean
  onHint: () => void
  onNewGame: () => void
  /** Fired only after the user holds the CTA to completion. */
  onQuit: () => void
}

const HOLD_MS = 1100
const TRAPEZOID = 'polygon(16px 0%, 100% 0%, calc(100% - 16px) 100%, 0% 100%)'

const LABEL: React.CSSProperties = {
  fontFamily: 'var(--fd)',
  fontWeight: 800,
  fontSize: 13,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
}

export default function GameActionBar({
  gameOver,
  quitForfeits,
  hintDisabled,
  isHintLoading,
  onHint,
  onNewGame,
  onQuit,
}: GameActionBarProps) {
  const [holding, setHolding] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fired = useRef(false)
  const danger = '#ff5a5f'

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

  return (
    <div
      className="pc-bottom-nav"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 60,
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)',
        background: 'linear-gradient(180deg, transparent, rgba(6,6,15,0.82) 38%)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      {/* 80% — trapezoid CTA */}
      {gameOver ? (
        <motion.button
          type="button"
          onClick={onNewGame}
          whileTap={{ scale: 0.97 }}
          style={{
            flex: '0 0 80%',
            height: 56,
            position: 'relative',
            border: 'none',
            cursor: 'pointer',
            clipPath: TRAPEZOID,
            background: 'var(--btn-face)',
            color: 'var(--btn-text)',
            boxShadow: 'var(--btn-shadow)',
            WebkitTapHighlightColor: 'transparent',
            ...LABEL,
          }}
        >
          New Game
        </motion.button>
      ) : (
        <motion.button
          type="button"
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          whileTap={{ scale: 0.985 }}
          aria-label={quitForfeits ? 'Hold to resign and quit' : 'Hold to quit'}
          style={{
            flex: '0 0 80%',
            height: 56,
            position: 'relative',
            overflow: 'hidden',
            border: 'none',
            cursor: 'pointer',
            clipPath: TRAPEZOID,
            background: 'linear-gradient(180deg, #1a1a30, #111124)',
            boxShadow: `inset 0 0 0 1.5px ${danger}55, 0 6px 0 rgba(0,0,0,.5), 0 10px 26px rgba(0,0,0,.45)`,
            color: danger,
            touchAction: 'none',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {/* battery fill — grows left→right while holding */}
          <motion.span
            aria-hidden
            initial={false}
            animate={{ scaleX: holding ? 1 : 0 }}
            transition={{ duration: holding ? HOLD_MS / 1000 : 0.16, ease: 'linear' }}
            style={{
              position: 'absolute',
              inset: 0,
              transformOrigin: 'left',
              background: `linear-gradient(90deg, ${danger}cc, ${danger})`,
              zIndex: 0,
            }}
          />
          {/* battery cell separators */}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              opacity: holding ? 0.4 : 0,
              transition: 'opacity .15s',
              background: 'repeating-linear-gradient(90deg, transparent 0 22px, rgba(0,0,0,.35) 22px 24px)',
            }}
          />
          <span className="relative" style={{ zIndex: 2, color: holding ? '#fff' : danger, ...LABEL }}>
            {holding ? 'Keep holding…' : quitForfeits ? 'Hold to Resign' : 'Hold to Quit'}
          </span>
        </motion.button>
      )}

      {/* 20% — bulb hint */}
      <motion.button
        type="button"
        onClick={hintDisabled || isHintLoading ? undefined : onHint}
        disabled={hintDisabled || isHintLoading}
        whileTap={hintDisabled || isHintLoading ? undefined : { scale: 0.93 }}
        aria-label="Get hint"
        style={{
          flex: '1 1 0',
          height: 56,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          cursor: hintDisabled || isHintLoading ? 'not-allowed' : 'pointer',
          opacity: hintDisabled ? 0.4 : 1,
          clipPath: 'polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%)',
          background: 'linear-gradient(180deg, #1a1a30, #111124)',
          boxShadow: 'inset 0 0 0 1.5px color-mix(in srgb, var(--candy-amber) 45%, transparent), 0 6px 0 rgba(0,0,0,.5)',
          color: 'var(--candy-amber)',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <HintBulbIcon size={26} glow={!hintDisabled && !isHintLoading} />
      </motion.button>
    </div>
  )
}
