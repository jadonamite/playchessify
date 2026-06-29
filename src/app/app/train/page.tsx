'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLearner } from '@/hooks/useLearner'
import { COACHES, getCoach } from '@/config/coaches'
import { suggestLesson } from '@/config/curriculum'
import { CONCEPT_LABEL, weakestConcepts } from '@/types/training'

export default function TrainHubPage() {
  const router = useRouter()
  const { learner, loading, update } = useLearner()
  const [switching, setSwitching] = useState(false)
  const adoptedQuery = useRef(false)

  const coach = getCoach(learner?.coachId)

  // Adopt the coach chosen on the landing page (?coach=…), once, if it differs.
  useEffect(() => {
    if (adoptedQuery.current || !learner) return
    const q = new URLSearchParams(window.location.search).get('coach')
    if (q && COACHES.some((c) => c.id === q) && q !== learner.coachId) {
      adoptedQuery.current = true
      void update({ coachId: q }).catch(() => {})
    }
  }, [learner, update])

  const pickCoach = async (id: string) => {
    if (id === learner?.coachId) return
    setSwitching(true)
    try { await update({ coachId: id }) } catch { /* declined */ } finally { setSwitching(false) }
  }

  if (loading && !learner) {
    return <div className="mx-auto max-w-2xl px-4 py-10 text-center text-slate-400">Loading your training…</div>
  }

  const weak = learner ? weakestConcepts(learner, 3) : []
  const nextLesson = learner ? suggestLesson(learner, weak) : undefined

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-300/80">Train</div>
        <h1 className="font-bold text-2xl text-white">Your coach, game after game</h1>
      </div>

      {/* Coach picker */}
      <div className="mb-6">
        <div className="mb-2 text-sm text-slate-400">Your coach</div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COACHES.map((c) => {
            const active = c.id === coach.id
            return (
              <button key={c.id} onClick={() => pickCoach(c.id)} disabled={switching}
                className="flex shrink-0 flex-col items-center gap-1.5"
                style={{ opacity: active ? 1 : 0.55 }}>
                <span className="h-16 w-16 overflow-hidden rounded-full border-2"
                      style={{ borderColor: active ? c.accent : 'rgba(255,255,255,0.15)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={encodeURI(c.img)} alt={c.name} className="h-full w-full object-cover object-top" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wide"
                      style={{ color: active ? '#eaf6ff' : '#7f94ad' }}>{c.short}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Not placed yet → placement CTA */}
      {!learner?.placed ? (
        <div className="rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-400/10 to-transparent p-6">
          <h2 className="font-bold text-lg text-white">First, let&apos;s see where you stand</h2>
          <p className="mt-1 text-sm text-slate-300">
            A quick five-position check so {coach.name} starts you at the right level — not back at square one.
          </p>
          <button onClick={() => router.push('/app/train/placement')}
                  className="mt-4 rounded-xl bg-cyan-400 px-5 py-3 font-bold text-[#04121a] hover:brightness-110">
            Take the placement ▸
          </button>
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

          {/* Next lesson */}
          {nextLesson && (
            <button onClick={() => router.push(`/app/train/lesson/${nextLesson.id}`)}
                    className="mb-3 block w-full rounded-2xl border p-5 text-left transition hover:bg-white/5"
                    style={{ borderColor: coach.accent + '44' }}>
              <div className="text-xs uppercase tracking-widest" style={{ color: coach.accent }}>Next lesson</div>
              <div className="mt-1 font-bold text-lg text-white">{nextLesson.title}</div>
              <div className="mt-1 text-sm text-slate-400">{CONCEPT_LABEL[nextLesson.concept]} · {nextLesson.steps.length} positions</div>
            </button>
          )}

          {/* Guided game */}
          <button onClick={() => router.push('/app/train/game')}
                  className="block w-full rounded-2xl py-4 font-bold text-[#04121a] transition hover:brightness-110"
                  style={{ backgroundColor: coach.accent }}>
            Play a guided game with {coach.name} ▸
          </button>
        </>
      )}
    </div>
  )
}
