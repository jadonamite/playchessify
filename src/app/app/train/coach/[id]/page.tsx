'use client'

import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getCoach } from '@/config/coaches'
import type { Specialty } from '@/config/coaches'
import TrapButton from '@/components/train/TrapButton'
import { useCoachStore } from '@/hooks/useCoachStore'

/** Specialty → the promise the coach makes in their introduction. */
const PROMISE: Record<Specialty, string> = {
  attack: 'Together we\'ll learn to seize the initiative and hunt the enemy king from the very first move.',
  tactics: 'I\'ll sharpen your eye until you see the combinations everyone else misses — the forks, the pins, the winning blow.',
  positional: 'I\'ll teach you the quiet art: good squares, prophylaxis, and squeezing a position until your opponent can\'t breathe.',
  endgame: 'I\'ll show you how the smallest edge becomes a full point — clean technique and the patience to outlast anyone.',
  universal: 'We\'ll build rock-solid, all-round fundamentals so you\'re dangerous in every kind of position.',
}

/**
 * CoachIntroPage
 * @returns {*}
 */
export default function CoachIntroPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const coach = getCoach(params.id)
  const setCoachId = useCoachStore((s) => s.setCoachId)

  const begin = () => { setCoachId(coach.id); router.push(`/app/train?coach=${coach.id}`) }

  // First-person introduction composed from the coach's own data — always works,
  // no LLM needed, so it's reliable on production.
  const intro = useMemo(() => {
    const traits = coach.tags.split(' · ').join(', ').toLowerCase()
    return [
      `I'm ${coach.name}. Some call me ${coach.title}.`,
      `My game is ${traits}. ${PROMISE[coach.teaching.specialty]}`,
      `Here's how this works: you play, and I watch every move. When you go wrong, I'll stop you, show you exactly why, and let you try again. When you find the right idea, you'll hear it from me. Game after game, I'll meet you where you are and push you forward.`,
    ]
  }, [coach])

  return (
    <div className="relative mx-auto w-full max-w-2xl px-4 py-8">
      {/* ambient glow in the coach's accent */}
      <div className="pointer-events-none absolute left-1/2 top-10 h-64 w-64 -translate-x-1/2 rounded-full opacity-40 blur-3xl"
           style={{ background: `radial-gradient(circle, ${coach.accent}55, transparent 70%)` }} />

      <div className="relative flex flex-col items-center text-center">
        <div className="h-40 w-40 overflow-hidden rounded-full border-2 shadow-2xl"
             style={{ borderColor: coach.accent, boxShadow: `0 20px 60px ${coach.accent}55` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={encodeURI(coach.img)} alt={coach.name} className="h-full w-full object-cover object-top" />
        </div>

        <div className="mt-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em]">
          <span style={{ color: coach.accent }}>{coach.rarity}</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-300">ELO {coach.elo.toLocaleString()}</span>
        </div>
        <h1 className="mt-2 font-bold text-3xl text-white">{coach.name}</h1>
        <div className="text-base" style={{ color: coach.accent }}>{coach.title}</div>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {coach.tags.split(' · ').map((t) => (
            <span key={t} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">{t}</span>
          ))}
        </div>
      </div>

      {/* spoken introduction */}
      <div className="relative mt-8 space-y-4 rounded-2xl border p-6"
           style={{ borderColor: coach.accent + '33', background: `linear-gradient(160deg, ${coach.accent}10, rgba(9,15,30,0.6))` }}>
        {intro.map((p, i) => (
          <p key={i} className={i === 0 ? 'text-lg font-semibold text-white' : 'text-[15px] leading-relaxed text-slate-200'}>{p}</p>
        ))}
      </div>

      <div className="relative mt-7 flex flex-col items-stretch gap-3 sm:flex-row">
        <div className="flex-1">
          <TrapButton accent={coach.accent} onClick={begin}>
            Begin with {coach.short} ▸
          </TrapButton>
        </div>
        <button onClick={() => router.push('/app/train')}
                className="rounded-xl border border-white/15 px-5 py-4 text-slate-300 transition hover:bg-white/5">
          Choose another coach
        </button>
      </div>
    </div>
  )
}
