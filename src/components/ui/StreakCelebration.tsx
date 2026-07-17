'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Confetti from './Confetti'
import { FlameIcon } from './icons'
import {
  STREAK_EVENT,
  STREAK_CELEBRATED_KEY,
  STREAK_NUDGE_KEY,
  STAR_CELEBRATED_KEY,
  streakDay,
  type StreakEventDetail,
} from '@/hooks/useStreak'

/**
 * Full-page streak overlay. Mounted once in the app shell; listens for
 * STREAK_EVENT and takes over the screen in one of three modes:
 *
 *  - `earned` → play-streak celebration after a completed game: lit flame,
 *               counting-up number, filled 7-day strip, confetti burst.
 *  - `nudge`  → a daily prompt for users sitting on a 0 streak.
 *  - `star`   → WIN-streak celebration: a star flings up. Dispatched after the
 *               flame, so a winning game pops flame → star in sequence.
 *
 * Events queue (not overwrite), so flame then star show one after another. Each
 * mode shows at most once per UTC day (separate localStorage guards).
 */

const FLAME = '#ff8a3d'
const EMBER = '#7a6147'
const STAR  = '#ffb74d'

export default function StreakCelebration() {
  const router = useRouter()
  const [queue, setQueue] = useState<StreakEventDetail[]>([])
  const [count, setCount] = useState(0)

  const data = queue[0] ?? null
  const isNudge = data?.mode === 'nudge'
  const isStar  = data?.mode === 'star'
  // Advance the queue — the next celebration (if any) shows once this closes.
  const close = useCallback(() => setQueue((q) => q.slice(1)), [])

  // Listen for streak events from anywhere in the app.
  useEffect(() => {
    function onStreak(e: Event) {
      const detail = (e as CustomEvent<StreakEventDetail>).detail
      if (!detail) return
      const today = streakDay()
      const key =
        detail.mode === 'nudge' ? STREAK_NUDGE_KEY
        : detail.mode === 'star' ? STAR_CELEBRATED_KEY
        : STREAK_CELEBRATED_KEY

      if (detail.mode === 'nudge') {
        if (detail.current > 0) return // they already have a streak — nothing to nudge
      } else if (detail.current < 1) {
        return
      }

      try {
        if (localStorage.getItem(key) === today) return
        localStorage.setItem(key, today)
      } catch { /* storage blocked — still show this session */ }
      setQueue((q) => [...q, detail])
    }
    window.addEventListener(STREAK_EVENT, onStreak as EventListener)
    return () => window.removeEventListener(STREAK_EVENT, onStreak as EventListener)
  }, [])

  // Count up to the new value (earned + star modes).
  useEffect(() => {
    if (!data || data.mode === 'nudge') return
    const target = data.current
    const from = Math.max(0, target - 1)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the counter before the count-up animation
    setCount(from)
    let raf = 0
    const start = performance.now()
    const dur = 700
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      setCount(Math.round(from + (target - from) * t))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    const id = setTimeout(() => { raf = requestAnimationFrame(tick) }, 250)
    return () => { clearTimeout(id); cancelAnimationFrame(raf) }
  }, [data])

  const accent = isNudge ? EMBER : isStar ? STAR : FLAME
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const filled = data && !isNudge ? Math.min(data.current, 7) : 0
  const firstStar = !!data && isStar && data.current <= 1 && data.longest <= 1

  const playNow = useCallback(() => {
    close()
    router.push('/app/game/bot')
  }, [router, close])

  return (
    <AnimatePresence mode="wait">
      {data && (
        <motion.div
          key={data.mode + '-' + queue.length}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center px-5"
          style={{ background: 'rgba(8,6,3,0.92)', backdropFilter: 'blur(14px)' }}
          onClick={close}
        >
          {!isNudge && <Confetti variant="burst" palette="flame" count={40} />}

          <motion.div
            initial={{ scale: 0.86, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 220 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-[32px] overflow-hidden text-center px-8 pt-10 pb-8 flex flex-col items-center gap-5"
            style={{
              background: `linear-gradient(165deg, ${accent}1f, rgba(14,10,6,0.97) 62%)`,
              border: `1px solid ${accent}40`,
              boxShadow: `0 0 90px ${accent}33, 0 40px 80px rgba(0,0,0,0.6)`,
            }}
          >
            {/* icon — star (win streak) flings up; otherwise lit flame / ember */}
            <div className="relative flex items-center justify-center" style={{ height: 132 }}>
              <motion.div
                aria-hidden
                className="absolute rounded-full"
                animate={{ scale: [1, 1.18, 1], opacity: isNudge ? [0.3, 0.5, 0.3] : [0.6, 0.9, 0.6] }}
                transition={{ duration: isNudge ? 2.6 : 1.8, repeat: Infinity, ease: 'easeInOut' }}
                style={{ width: 150, height: 150, background: `radial-gradient(circle, ${accent}66, transparent 70%)` }}
              />
              {isStar ? (
                <motion.div
                  initial={{ y: 150, scale: 0.2, rotate: -40, opacity: 0 }}
                  animate={{ y: [150, -18, 0], scale: [0.2, 1.15, 1], rotate: [-40, 8, 0], opacity: 1 }}
                  transition={{ duration: 0.9, ease: [0.2, 0.9, 0.3, 1], times: [0, 0.7, 1] }}
                  style={{ fontSize: 104, lineHeight: 1, color: STAR, filter: `drop-shadow(0 0 30px ${STAR})` }}
                >
                  ★
                </motion.div>
              ) : (
                <motion.div
                  initial={{ scale: 0.4, rotate: -8 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 10, stiffness: 200, delay: 0.1 }}
                  style={{
                    color: accent,
                    opacity: isNudge ? 0.55 : 1,
                    filter: isNudge ? 'grayscale(0.3)' : `drop-shadow(0 0 28px ${FLAME})`,
                  }}
                >
                  <FlameIcon size={104} />
                </motion.div>
              )}
            </div>

            {isNudge ? (
              <>
                <div className="leading-tight">
                  <div className="text-[10px] font-black tracking-[0.4em] uppercase mb-2 text-[var(--t3)]">
                    {data.longest > 0 ? 'Streak Went Out' : 'No Streak Yet'}
                  </div>
                  <h2 className="text-4xl font-black uppercase tracking-tight" style={{ fontFamily: 'var(--fd)', color: '#fff' }}>
                    {data.longest > 0 ? 'Relight It' : 'Start Your Streak'}
                  </h2>
                </div>
                <p className="text-sm text-[var(--t3)] leading-relaxed max-w-[17rem]">
                  {data.longest > 0
                    ? `Your ${data.longest}-day best went cold. Play one game today to spark a new streak.`
                    : 'Play a game today to light your first flame — then come back daily to keep it burning.'}
                </p>
                {/* empty week strip — a teaser to fill */}
                <div className="flex items-center justify-center gap-2 opacity-70">
                  {dayLabels.map((d, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5">
                      <div
                        className="w-7 h-7 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.1)' }}
                      />
                      <span className="text-[8px] font-black uppercase text-[var(--t3)]">{d}</span>
                    </div>
                  ))}
                </div>
                <div className="w-full flex flex-col gap-2.5 mt-1">
                  <button
                    type="button"
                    onClick={playNow}
                    className="w-full py-3.5 rounded-2xl font-black uppercase tracking-widest text-sm active:scale-[0.98] transition-transform"
                    style={{
                      fontFamily: 'var(--fd)',
                      color: '#2a1500',
                      background: `linear-gradient(180deg, #ffd27a 0%, ${FLAME} 60%, #f2701a 100%)`,
                      boxShadow: `0 6px 0 #b9531f, 0 12px 26px ${FLAME}55`,
                    }}
                  >
                    Play now
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="w-full py-2 text-xs font-bold uppercase tracking-widest text-[var(--t3)] hover:text-[var(--t2)] transition-colors"
                  >
                    Maybe later
                  </button>
                </div>
              </>
            ) : isStar ? (
              <>
                <div className="leading-tight">
                  <div className="text-[10px] font-black tracking-[0.4em] uppercase mb-2" style={{ color: STAR }}>
                    {firstStar ? 'First Win' : 'Win Streak'}
                  </div>
                  {firstStar ? (
                    <h2 className="text-3xl font-black uppercase tracking-tight" style={{ fontFamily: 'var(--fd)', color: '#fff' }}>
                      Your First Star
                    </h2>
                  ) : (
                    <div
                      className="font-black tabular-nums leading-none"
                      style={{ fontFamily: 'var(--fd)', fontSize: 66, color: STAR, textShadow: `0 0 40px ${STAR}88` }}
                    >
                      {count}<span style={{ fontSize: 34 }}>★</span>
                    </div>
                  )}
                </div>

                <p className="text-sm text-[var(--t3)] leading-relaxed max-w-[17rem]">
                  {firstStar
                    ? "Here's a star for your first win. Win again tomorrow to get more stars."
                    : data.current === 1
                      ? 'A fresh star. Win again tomorrow to grow your streak.'
                      : `${data.current} days of wins — keep collecting stars!`}
                </p>

                {/* star strip — one ★ per winning day, up to a week */}
                <div className="flex items-center justify-center gap-2">
                  {dayLabels.map((d, i) => {
                    const lit = i < filled
                    return (
                      <div key={i} className="flex flex-col items-center gap-1.5">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.35 + i * 0.06, type: 'spring', damping: 12, stiffness: 240 }}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[13px]"
                          style={{
                            background: lit ? `${STAR}22` : 'rgba(255,255,255,0.04)',
                            border: `1.5px solid ${lit ? STAR : 'rgba(255,255,255,0.1)'}`,
                            color: lit ? STAR : 'var(--t3)',
                          }}
                        >
                          {lit ? '★' : null}
                        </motion.div>
                        <span className="text-[8px] font-black uppercase" style={{ color: lit ? STAR : 'var(--t3)' }}>{d}</span>
                      </div>
                    )
                  })}
                </div>

                <button
                  type="button"
                  onClick={close}
                  className="mt-1 w-full py-3.5 rounded-2xl font-black uppercase tracking-widest text-sm active:scale-[0.98] transition-transform"
                  style={{
                    fontFamily: 'var(--fd)',
                    color: '#2a1500',
                    background: `linear-gradient(180deg, #ffe08a 0%, ${STAR} 60%, #f59e0b 100%)`,
                    boxShadow: `0 6px 0 #b9770f, 0 12px 26px ${STAR}55`,
                  }}
                >
                  Nice!
                </button>
              </>
            ) : (
              <>
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
                  {data.current === 1
                    ? 'Your streak begins. Play tomorrow to keep the flame alive.'
                    : `${data.current} days strong — don't let it burn out!`}
                  {data.current >= data.longest && data.current > 1 && (
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
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
