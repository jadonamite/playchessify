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
  onQuit: () => void,
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
  const hintOff = hintDisabled || isHintLoading

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
      className="pc-game-bar"
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 12px',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)',
        background: 'linear-gradient(180deg, transparent, rgba(6,6,15,0.85) 38%)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 660 }}>
        {/* Primary CTA — hold-to-quit / new game (keeps the trapezoid shape) */}
        {gameOver ? (
          <motion.button
            type="button"
            onClick={onNewGame}
            whileTap={{ scale: 0.97 }}
            style={{
              flex: 1,
              height: 58,
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
              flex: 1,
              height: 58,
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
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
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

        {/* Hint — juicy raised amber button */}
        <motion.button
          type="button"
          onClick={hintOff ? undefined : onHint}
          disabled={hintOff}
          whileTap={hintOff ? undefined : { scale: 0.95, y: 2 }}
          aria-label="Get a hint"
          style={{
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            height: 58,
            padding: '0 22px',
            borderRadius: 16,
            border: 'none',
            cursor: hintOff ? 'not-allowed' : 'pointer',
            background: 'linear-gradient(180deg, #ffd27a 0%, #ffb74d 55%, #f59e2e 100%)',
            color: '#3a2400',
            boxShadow: hintOff
              ? 'none'
              : '0 6px 0 #b9791f, 0 10px 22px rgba(245,158,46,.35)',
            opacity: hintOff && !isHintLoading ? 0.45 : 1,
            filter: hintOff && !isHintLoading ? 'grayscale(0.6)' : 'none',
            WebkitTapHighlightColor: 'transparent',
            ...LABEL,
          }}
        >
          <HintBulbIcon size={22} glow={!hintOff} />
          {isHintLoading ? '…' : 'Hint'}
        </motion.button>
      </div>
    </div>
  )
}
