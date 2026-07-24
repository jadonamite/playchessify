'use client'

import TrapButton from '@/components/train/TrapButton'
import { COACHES, getCoach } from '@/config/coaches'
import { CONCEPT_LABEL, weakestConcepts } from '@/types/training'
import { suggestLesson } from '@/config/curriculum'
import { useCoachStore } from '@/hooks/useCoachStore'
import { useEffect, useRef } from 'react'
import { useLearner } from '@/hooks/useLearner'
import { useRouter } from 'next/navigation'

export default function TrainHubPage() {
  const router = useRouter()
  const { learner, loading, update } = useLearner()
  const adoptedQuery = useRef(false)
  const setCoachId = useCoachStore((s) => s.setCoachId)

  const coach = getCoach(learner?.coachId)

  // Keep the nav/lobby coach face in sync with the server learner model.
  useEffect(() => {
    if (learner?.coachId) setCoachId(learner.coachId)
  }, [learner?.coachId, setCoachId])

  // Adopt the coach chosen on the landing page (?coach=…), once, if it differs.
  useEffect(() => {
    if (adoptedQuery.current || !learner) return
    const q = new URLSearchParams(window.location.search).get('coach')
    if (q && COACHES.some((c) => c.id === q) && q !== learner.coachId) {
      adoptedQuery.current = true
      void update({ coachId: q }).catch(() => {})
    }
  }, [learner, update])

  if (loading && !learner) {
    return <div className="mx-auto max-w-2xl px-4 py-10 text-center text-slate-400">Loading your training…</div>
  }

  const weak = learner ? weakestConcepts(learner, 3) : []
  const nextLesson = learner ? suggestLesson(learner, weak) : undefined

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-5">
        <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-300/80">Train</div>
        <h1 className="font-bold text-2xl text-white">Your coach, game after game</h1>
      </div>

      {/* Locked-in coach — change only from Settings */}
      <div className="mb-6 flex items-center gap-3 rounded-2xl border p-3"
           style={{ borderColor: coach.accent + '40', background: `linear-gradient(160deg, ${coach.accent}10, rgba(9,15,30,0.5))` }}>
        <span className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2" style={{ borderColor: coach.accent }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={encodeURI(coach.img)} alt={coach.name} className="h-full w-full object-cover object-top" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-white">{coach.name}</div>
          <div className="text-xs" style={{ color: coach.accent }}>{coach.title}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button onClick={() => router.push(`/app/train/coach/${coach.id}`)}
                  className="text-xs underline-offset-2 hover:underline" style={{ color: coach.accent }}>Meet ›</button>
          <button onClick={() => router.push('/app/settings')}
                  className="text-[11px] text-slate-400 underline-offset-2 hover:underline">Change in Settings</button>
        </div>
      </div>

      {/* Not placed yet → placement CTA */}
      {!learner?.placed ? (
        <div className="rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-400/10 to-transparent p-6">
          <h2 className="font-bold text-lg text-white">First, let&apos;s see where you stand</h2>
          <p className="mt-1 text-sm text-slate-300">
            A quick five-position check so {coach.name} starts you at the right level — not back at square one.
          </p>
          <div className="mt-4 sm:max-w-xs">
            <TrapButton onClick={() => router.push('/app/train/placement')}>
              Take the placement ▸
            </TrapButton>
          </div>
        </div>
      ) : (
        <>
          {/* Level + weak spots */}
          <div className="mb-5 rounded-2xl border border-white/10 bg-[#0a1220]/70 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-slate-400">Current level</div>
                <div className="font-bold text-xl capitalize text-white">{learner.level}</div>
              </div>
              <button onClick={() => router.push('/app/train/placement')}
                      className="text-xs text-cyan-300 underline-offset-2 hover:underline">retake placement</button>
            </div>
            {weak.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-slate-400">Working on</div>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {weak.map((c) => (
                    <span key={c} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                      {CONCEPT_LABEL[c]}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Next lesson — now clearly a pressable card with a Start pill */}
          {nextLesson && (
            <button onClick={() => router.push(`/app/train/lesson/${nextLesson.id}`)}
                    className="mb-5 flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition hover:bg-white/5"
                    style={{ borderColor: coach.accent + '55', background: `linear-gradient(160deg, ${coach.accent}0d, transparent)` }}>
              <div className="min-w-0 flex-1">
                <div className="text-xs uppercase tracking-widest" style={{ color: coach.accent }}>Next lesson</div>
                <div className="mt-1 font-bold text-lg text-white">{nextLesson.title}</div>
                <div className="mt-1 text-sm text-slate-400">{CONCEPT_LABEL[nextLesson.concept]} · {nextLesson.steps.length} positions</div>
              </div>
              <span className="shrink-0 rounded-full px-4 py-2 text-sm font-bold text-[#04121a]" style={{ background: coach.accent }}>
                Start ▸
              </span>
            </button>
          )}

          {/* Two ways to play */}
          <div className="mb-2 text-sm text-slate-400">Play with {coach.name}</div>
          <div className="flex flex-col gap-3">
            <TrapButton accent={coach.accent} onClick={() => router.push('/app/train/game?mode=guided')}>
              Play a guided game ▸
            </TrapButton>
            <TrapButton accent="#fb7185" onClick={() => router.push('/app/train/game?mode=match')}>
              Challenge {coach.name} to a full match ▸
            </TrapButton>
          </div>
        </>
      )}
    </div>
  )
}
