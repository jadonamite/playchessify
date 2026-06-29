'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Confetti from './Confetti'
import { FlameIcon } from './icons'
import { STREAK_EVENT, type RecordResult } from '@/hooks/useStreak'

/**
 * Full-page Duolingo-style streak celebration. Mounted once in the app shell;
 * listens for the STREAK_EVENT dispatched by useRecordStreak when a play
 * advances the streak, and takes over the screen with a flame, a counting-up
 * number, a 7-day strip and a confetti burst. Shows at most once per UTC day.
 */

const FLAME = '#ff8a3d'
const CELEBRATED_KEY = 'chess:streak:celebrated'

function utcToday(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function StreakCelebration() {
  const [streak, setStreak] = useState<RecordResult | null>(null)
  const [count, setCount] = useState(0)

  const close = useCallback(() => setStreak(null), [])

  // Listen for streak advances from anywhere in the app.
  useEffect(() => {
    function onStreak(e: Event) {
      const detail = (e as CustomEvent<RecordResult>).detail
      if (!detail?.incremented) return
      const today = utcToday()
      try {
        if (localStorage.getItem(CELEBRATED_KEY) === today) return
        localStorage.setItem(CELEBRATED_KEY, today)
      } catch { /* storage blocked — still celebrate this session */ }
      setStreak(detail)
    }
    window.addEventListener(STREAK_EVENT, onStreak as EventListener)
    return () => window.removeEventListener(STREAK_EVENT, onStreak as EventListener)
  }, [])

  // Count up to the new streak value.
  useEffect(() => {
    if (!streak) return
    const target = streak.current
    const from = Math.max(0, target - 1)
    setCount(from)
    let raf = 0
    const start = performance.now()
    const dur = 700
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      setCount(Math.round(from + (target - from) * t))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    // brief beat before the number lands
    const id = setTimeout(() => { raf = requestAnimationFrame(tick) }, 250)
    return () => { clearTimeout(id); cancelAnimationFrame(raf) }
  }, [streak])

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const filled = streak ? Math.min(streak.current, 7) : 0

  return (
    <AnimatePresence>
      {streak && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center px-5"
          style={{ background: 'rgba(8,6,3,0.92)', backdropFilter: 'blur(14px)' }}
          onClick={close}
        >
          <Confetti variant="burst" palette="flame" count={40} />

          <motion.div
            initial={{ scale: 0.86, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 220 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-[32px] overflow-hidden text-center px-8 pt-10 pb-8 flex flex-col items-center gap-5"
            style={{
              background: `linear-gradient(165deg, ${FLAME}1f, rgba(14,10,6,0.97) 62%)`,
              border: `1px solid ${FLAME}40`,
              boxShadow: `0 0 90px ${FLAME}33, 0 40px 80px rgba(0,0,0,0.6)`,
            }}
          >
            {/* flame with pulsing halo */}
            <div className="relative flex items-center justify-center" style={{ height: 132 }}>
              <motion.div
                aria-hidden
                className="absolute rounded-full"
                animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0.9, 0.6] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                style={{ width: 150, height: 150, background: `radial-gradient(circle, ${FLAME}66, transparent 70%)` }}
              />
              <motion.div
                initial={{ scale: 0.4, rotate: -8 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 10, stiffness: 200, delay: 0.1 }}
                style={{ color: FLAME, filter: `drop-shadow(0 0 28px ${FLAME})` }}
              >
                <FlameIcon size={104} />
              </motion.div>
            </div>

            {/* count */}
            <div className="leading-none">
              <div
                className="font-black tabular-nums"
                style={{ fontFamily: 'var(--fd)', fontSize: 72, color: FLAME, textShadow: `0 0 40px ${FLAME}88` }}
              >
                {count}
              </div>
              <div className="text-[11px] font-black tracking-[0.4em] uppercase mt-1 text-[var(--t2)]">
                Day Streak
              </div>
            </div>

            <p className="text-sm text-[var(--t3)] leading-relaxed max-w-[16rem]">
              {streak.current === 1
                ? 'Your streak begins. Play tomorrow to keep the flame alive.'
                : `${streak.current} days strong — don't let it burn out!`}
              {streak.current >= streak.longest && streak.current > 1 && (
                <span className="block mt-1 font-bold" style={{ color: FLAME }}>🏆 New personal best!</span>
              )}
            </p>

            {/* 7-day strip */}
            <div className="flex items-center justify-center gap-2">
              {dayLabels.map((d, i) => {
                const lit = i < filled
                return (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.06, type: 'spring', damping: 12, stiffness: 240 }}
                      className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{
                        background: lit ? `${FLAME}22` : 'rgba(255,255,255,0.04)',
                        border: `1.5px solid ${lit ? FLAME : 'rgba(255,255,255,0.1)'}`,
                        color: lit ? FLAME : 'var(--t3)',
                      }}
                    >
                      {lit ? <FlameIcon size={15} /> : null}
                    </motion.div>
                    <span className="text-[8px] font-black uppercase" style={{ color: lit ? FLAME : 'var(--t3)' }}>{d}</span>
                  </div>
                )
              })}
            </div>

            {/* CTA — clay/candy puffy button (not a trapezoid GlowButton) */}
            <button
              type="button"
              onClick={close}
              className="mt-1 w-full py-3.5 rounded-2xl font-black uppercase tracking-widest text-sm active:scale-[0.98] transition-transform"
              style={{
                fontFamily: 'var(--fd)',
                color: '#2a1500',
                background: `linear-gradient(180deg, #ffd27a 0%, ${FLAME} 60%, #f2701a 100%)`,
                boxShadow: `0 6px 0 #b9531f, 0 12px 26px ${FLAME}55`,
              }}
            >
              Keep it going
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
