'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

// One greeting per MiniPay region — Africa-first (its core base) plus the big
// Asian markets it reaches. Western/LatAm locales were dropped: no MiniPay
// footprint, and a Lagos or Nairobi user reads "Ciao"/"G'day" as filler.
// "Champ" is translated wherever a real native word exists (Bingwa, Champion,
// Campeão, Juara, Kampeon, Nhà vô địch).
//
// Latin scripts render in Plus Jakarta Sans (incl. its vietnamese subset). Hindi
// and Amharic have no Latin coverage, so they use Noto Sans Devanagari/Ethiopic —
// text-subsetted and loaded via plain async <link>s below.
//
// `size` optically matches each line's width to the English baseline so the
// greeting doesn't jump between cross-fades.
const JAKARTA   = 'var(--fb)'
const NOTO_DEVA = "'Noto Sans Devanagari', var(--fb)"
const NOTO_ETHI = "'Noto Sans Ethiopic', var(--fb)"

interface Greeting {
  lang: string        // BCP-47, for screen readers
  text: string
  font: string
  size: number        // rem, mobile base — scaled up at md
  track: string       // letter-spacing
}

const GREETINGS: Greeting[] = [
  { lang: 'en',    text: 'Hello, Champ',          font: JAKARTA,   size: 2.6, track: '-0.03em' },
  { lang: 'sw',    text: 'Habari, Bingwa',        font: JAKARTA,   size: 2.5, track: '-0.03em' },
  { lang: 'fr',    text: 'Salut, Champion',       font: JAKARTA,   size: 2.3, track: '-0.03em' },
  { lang: 'hi',    text: 'नमस्ते, विजेता',            font: NOTO_DEVA, size: 2.3, track: '0'       },
  { lang: 'am',    text: 'ሰላም, ጀግና',              font: NOTO_ETHI, size: 2.3, track: '0'       },
  { lang: 'pt-BR', text: 'Olá, Campeão',          font: JAKARTA,   size: 2.6, track: '-0.03em' },
  { lang: 'id',    text: 'Halo, Juara',           font: JAKARTA,   size: 2.7, track: '-0.03em' },
  { lang: 'fil',   text: 'Kumusta, Kampeon',      font: JAKARTA,   size: 2.2, track: '-0.03em' },
  { lang: 'vi',    text: 'Xin chào, Nhà vô địch', font: JAKARTA,   size: 1.9, track: '-0.02em' },
  { lang: 'ms',    text: 'Apa khabar, Juara',     font: JAKARTA,   size: 2.1, track: '-0.03em' },
]

// Noto subsets — text-scoped to just the two non-Latin greetings (~4.5KB total).
// Plain links, NO `precedence`: a precedence-marked stylesheet is a Suspense
// resource that would freeze the gate until it loads. These mount at gate open,
// so Noto is ready long before the cycle reaches Hindi (pos 4) / Amharic (pos 7);
// display=swap covers the interim.
const DEVA_HREF = `https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@700&text=${encodeURIComponent('नमस्ते, विजेता')}&display=swap`
const ETHI_HREF = `https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic:wght@700&text=${encodeURIComponent('ሰላም, ጀግና')}&display=swap`

// A calm hold — long enough to read each greeting without it feeling like a
// slideshow. English leads (index 0) and gets an extra beat as the anchor.
const HOLD_MS = 2000
const LEAD_MS: number = 2800

interface WelcomeGateProps {
  open: boolean
  onDone: () => void
}

function WelcomeGateInner({ onDone }: { onDone: () => void }) {
  const reduceMotion = useReducedMotion()
  const [i, setI] = useState(0)

  // Cycle forever until tapped — a cycle that ends leaves the screen sitting in a
  // dead state waiting for input. English (index 0) leads and holds a touch
  // longer; a self-rescheduling timeout lets that first beat differ from the rest.
  useEffect(() => {
    if (reduceMotion) return
    const t = setTimeout(() => setI((n) => (n + 1) % GREETINGS.length), i === 0 ? LEAD_MS : HOLD_MS)
    return () => clearTimeout(t)
  }, [reduceMotion, i])

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
      <link rel="stylesheet" href={DEVA_HREF} />
      <link rel="stylesheet" href={ETHI_HREF} />

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

      {/* Pure-opacity cross-dissolve: entering and exiting greetings overlap in
          the same absolutely-centred slot, so there's never a blank frame (no
          flash) and no `mode="wait"` deadlock. No translate — a straight fade is
          the smoothest read, and the overlap keeps it continuous at a short hold. */}
      <div className="relative z-10 flex items-center justify-center px-6 w-full" style={{ minHeight: '4.5em' }}>
        <AnimatePresence initial={false}>
          <motion.span
            key={g.lang}
            lang={g.lang}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 1.0, ease: 'easeInOut' }}
            className="absolute text-center leading-tight will-change-[opacity]"
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
