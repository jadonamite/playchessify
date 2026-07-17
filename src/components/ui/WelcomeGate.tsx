'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

// One greeting per region — English leads, then a spread across Europe, SE Asia,
// Latin America and Oceania. "Champ" is translated wherever a real native word
// exists (Mästare, Kampeon, Nhà vô địch, Campione, Campeón, Juara); the greeting
// itself carries local flavour (Colombia's "Quiubo", Argentina's "Che",
// Australia's "G'day"). Every string is fully covered by Plus Jakarta Sans —
// including its vietnamese subset — so there is one font and no runtime loading.
//
// `size` optically matches each line's width to the English baseline so the
// greeting doesn't jump between cross-fades.
interface Greeting {
  lang: string        // BCP-47, for screen readers
  text: string
  size: number        // rem, mobile base — scaled up at md
}

const GREETINGS: Greeting[] = [
  { lang: 'en',    text: 'Hello, Champ',          size: 2.6 },
  { lang: 'sv',    text: 'Hej, Mästare',          size: 2.6 },
  { lang: 'fil',   text: 'Kumusta, Kampeon',      size: 2.2 },
  { lang: 'vi',    text: 'Xin chào, Nhà vô địch', size: 1.9 },
  { lang: 'it',    text: 'Ciao, Campione',        size: 2.4 },
  { lang: 'es-CO', text: 'Quiubo, Campeón',       size: 2.3 },
  { lang: 'es-AR', text: 'Che, Campeón',          size: 2.6 },
  { lang: 'ms',    text: 'Apa khabar, Juara',     size: 2.1 },
  { lang: 'en-AU', text: "G'day, Champ",          size: 2.6 },
]

// A calm hold — long enough to read each greeting without it feeling like a
// slideshow. English leads (index 0) and gets an extra beat as the anchor.
const HOLD_MS = 2800
const LEAD_MS = 3600

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

      {/* Cross-dissolve: the entering and exiting greetings overlap in the same
          absolutely-centred slot, so there's never a blank frame (no flash) and
          no `mode="wait"` deadlock. Opacity + a gentle 8px rise, no blur. */}
      <div className="relative z-10 flex items-center justify-center px-6 w-full" style={{ minHeight: '4.5em' }}>
        <AnimatePresence initial={false}>
          <motion.span
            key={g.lang}
            lang={g.lang}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
            className="absolute text-center leading-tight will-change-[opacity,transform]"
            style={{
              fontFamily: 'var(--fb)',
              fontWeight: 800,
              fontSize: `clamp(${g.size}rem, ${g.size * 2.4}vw, ${g.size * 1.5}rem)`,
              letterSpacing: '-0.03em',
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
