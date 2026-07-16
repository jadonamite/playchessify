'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

// One greeting per region of the global south. "Champ" is translated wherever a
// real native word exists (Bingwa, Juara, Campeão, Champion) rather than
// transliterated — a loanword in another script reads as machine output.
//
// `size` and `track` optically match each line to the English baseline: the two
// non-Latin faces have different cap heights to Plus Jakarta, so without this the
// greeting visibly jumps as the cycle crosses scripts.
interface Greeting {
  lang: string        // BCP-47, for screen readers
  text: string
  font: string        // CSS font-family stack
  size: number        // rem, mobile base — scaled up at md
  track: string       // letter-spacing
}

const NOTO_DEVA = "'Noto Sans Devanagari', sans-serif"
const NOTO_ETHI = "'Noto Sans Ethiopic', sans-serif"
const JAKARTA   = "var(--fb)"

const GREETINGS: Greeting[] = [
  { lang: 'en',    text: 'Hello, Champ',    font: JAKARTA,   size: 2.6,  track: '-0.03em' },
  { lang: 'pcm',   text: 'How far, Champ',  font: JAKARTA,   size: 2.4,  track: '-0.03em' },
  { lang: 'sw',    text: 'Habari, Bingwa',  font: JAKARTA,   size: 2.5,  track: '-0.03em' },
  { lang: 'fr',    text: 'Salut, Champion', font: JAKARTA,   size: 2.3,  track: '-0.03em' },
  { lang: 'id',    text: 'Halo, Juara',     font: JAKARTA,   size: 2.7,  track: '-0.03em' },
  { lang: 'pt-BR', text: 'Olá, Campeão',    font: JAKARTA,   size: 2.6,  track: '-0.03em' },
  { lang: 'hi',    text: 'नमस्ते, विजेता',      font: NOTO_DEVA, size: 2.3,  track: '0' },
  { lang: 'am',    text: 'ሰላም, ጀግና',        font: NOTO_ETHI, size: 2.3,  track: '0' },
]

// Google Fonts serves a per-string subset via &text= — a few hundred bytes each
// instead of the full face. next/font/google has no equivalent option, so these
// are plain <link>s; React hoists and dedupes them.
const DEVA_HREF = `https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@700&text=${encodeURIComponent('नमस्ते, विजेता')}&display=swap`
const ETHI_HREF = `https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic:wght@700&text=${encodeURIComponent('ሰላም, ጀግና')}&display=swap`

export const WELCOME_SEEN_KEY = 'pc-welcome-seen'

const HOLD_MS = 1600

interface WelcomeGateProps {
  open: boolean
  onDone: () => void
}

function WelcomeGateInner({ onDone }: { onDone: () => void }) {
  const reduceMotion = useReducedMotion()
  const [i, setI] = useState(0)

  // Cycle forever until tapped — a cycle that ends leaves the screen sitting in a
  // dead state waiting for input.
  useEffect(() => {
    if (reduceMotion) return
    const t = setInterval(() => setI((n) => (n + 1) % GREETINGS.length), HOLD_MS)
    return () => clearInterval(t)
  }, [reduceMotion])

  const g = reduceMotion ? GREETINGS[0] : GREETINGS[i]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
      onClick={onDone}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onDone() }}
      aria-label="Welcome — tap to continue"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden select-none cursor-pointer bg-[var(--bg)]"
    >
      <link rel="stylesheet" href={DEVA_HREF} precedence="default" />
      <link rel="stylesheet" href={ETHI_HREF} precedence="default" />

      {/* grid backdrop — matches the lobby + match intro */}
      <div
        className="absolute inset-0 pointer-events-none z-0 opacity-40"
        style={{
          backgroundImage: 'linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />

      {/* soft centre bloom */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--c) 9%, transparent) 0%, transparent 60%)' }}
      />

      <div className="relative z-10 flex items-center justify-center px-6 w-full" style={{ minHeight: '4.5em' }}>
        <AnimatePresence mode="wait">
          <motion.span
            key={g.lang}
            lang={g.lang}
            initial={reduceMotion ? false : { opacity: 0, y: 14, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -14, filter: 'blur(6px)' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="text-center leading-tight"
            style={{
              fontFamily: g.font,
              fontWeight: 800,
              fontSize: `clamp(${g.size}rem, ${g.size * 2.4}vw, ${g.size * 1.5}rem)`,
              letterSpacing: g.track,
              color: 'var(--t1)',
              textShadow: '0 0 40px color-mix(in srgb, var(--c) 22%, transparent)',
            }}
          >
            {g.text}
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="absolute bottom-10 inset-x-0 z-10 text-center pointer-events-none px-6">
        <motion.span
          animate={reduceMotion ? undefined : { opacity: [0.35, 0.75, 0.35] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          className="text-[10px] font-bold tracking-[0.3em] uppercase"
          style={{ color: 'var(--t3)', fontFamily: 'var(--fb)' }}
        >
          Tap to continue
        </motion.span>
      </div>
    </motion.div>
  )
}

export default function WelcomeGate({ open, onDone }: WelcomeGateProps) {
  return (
    <AnimatePresence>
      {open && <WelcomeGateInner onDone={onDone} />}
    </AnimatePresence>
  )
}
