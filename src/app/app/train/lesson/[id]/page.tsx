'use client'

import { useCallback, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Chess } from 'chess.js'
import TrainingBoard from '@/components/train/TrainingBoard'
import { useAnalysis } from '@/hooks/useAnalysis'
import { useLearner } from '@/hooks/useLearner'
import { fetchCoachVoice } from '@/lib/coach/client'
import { getCoach } from '@/config/coaches'
import { lessonById, type DrillStep } from '@/config/curriculum'
import { CONCEPT_LABEL } from '@/types/training'
import TrapButton from '@/components/train/TrapButton'

type Phase = 'solving' | 'checking' | 'wrong' | 'right' | 'complete'

export default function LessonPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const lesson = lessonById(params.id)

  const { analyze } = useAnalysis()
  const { learner, update } = useLearner()
  const coach = getCoach(learner?.coachId)
  const level = learner?.level ?? 'basics'

  const [stepIdx, setStepIdx] = useState(0)
  const [game, setGame] = useState(() => new Chess(lesson?.steps[0].fen))
  const [phase, setPhase] = useState<Phase>('solving')
  const [hintIdx, setHintIdx] = useState(-1)
  const [voice, setVoice] = useState('')
  const [saving, setSaving] = useState(false)

  const step: DrillStep | undefined = lesson?.steps[stepIdx]

  const judge = useCallback(async (fen: string, uci: string, postFen: string): Promise<boolean> => {
    const pre = await analyze(fen, { movetime: 300 })
    if (!pre) return uci === step?.expectedUci
    if (pre.bestMove === uci) return true
    const post = await analyze(postFen, { movetime: 300 })
    if (!post) return uci === step?.expectedUci
    return pre.whiteCp - post.whiteCp <= 60
  }, [analyze, step])

  const onMove = useCallback((from: string, to: string): boolean => {
    if (!step || phase === 'checking' || phase === 'right') return false
    const probe = new Chess(step.fen)
    const move = probe.move({ from, to, promotion: 'q' })
    if (!move) return false
    setGame(probe)
    setPhase('checking')
    void (async () => {
      const ok = await judge(step.fen, from + to, probe.fen())
      if (ok) {
        setPhase('right')
        const v = await fetchCoachVoice({
          coachName: coach.name, coachVoice: coach.teaching.voice, learnerLevel: level,
          kind: 'good', playerMoveSan: move.san, concept: CONCEPT_LABEL[lesson!.concept], fen: step.fen,
        })
        setVoice(v.text)
      } else {
        // Wrong — reset board, escalate the hint ladder, let them retry.
        setGame(new Chess(step.fen))
        setHintIdx((i) => Math.min((step.hints?.length ?? 1) - 1, i + 1))
        setPhase('wrong')
      }
    })()
    return true
  }, [step, phase, judge, coach, level, lesson])

  const advance = useCallback(async () => {
    if (!lesson) return
    if (stepIdx + 1 < lesson.steps.length) {
      const n = stepIdx + 1
      setStepIdx(n)
      setGame(new Chess(lesson.steps[n].fen))
      setHintIdx(-1)
      setVoice('')
      setPhase('solving')
      return
    }
    // Lesson complete — bump concept mastery and mark done.
    setPhase('complete')
    setSaving(true)
    const current = learner?.concepts[lesson.concept] ?? 0
    try {
      await update({
        completedLesson: lesson.id,
        concepts: { [lesson.concept]: Math.min(1, current + 0.25) },
      })
    } catch { /* not connected / declined — lesson still completes locally */ }
    router.replace('/app/train')
  }, [lesson, stepIdx, learner, update, router])

  const board = useMemo(() => step && (
    <TrainingBoard game={game} orientation="white" interactive={phase === 'solving' || phase === 'wrong'} onMove={onMove} />
  ), [game, step, phase, onMove])

  if (!lesson || !step) {
    return <div className="mx-auto max-w-xl px-4 py-10 text-center text-slate-400">Lesson not found.</div>
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: coach.accent }}>
            {coach.name} · {CONCEPT_LABEL[lesson.concept]}
          </div>
          <h1 className="font-bold text-xl text-white">{lesson.title}</h1>
        </div>
        <div className="text-right text-sm text-slate-400">Step {stepIdx + 1}/{lesson.steps.length}</div>
      </div>

      {stepIdx === 0 && phase === 'solving' && hintIdx === -1 && (
        <p className="mb-3 text-sm leading-relaxed text-slate-300">{lesson.intro}</p>
      )}

      <div className="rounded-2xl border border-white/10 bg-[#0a1220]/80 p-3">{board}</div>

      <div className="mt-4 min-h-[96px] rounded-xl border p-4"
           style={{ borderColor: phase === 'right' ? coach.accent + '66' : phase === 'wrong' ? '#fb718566' : 'rgba(255,255,255,0.1)' }}>
        {(phase === 'solving') && <p className="text-[15px] text-slate-200">{step.prompt}</p>}
        {phase === 'checking' && <p className="text-slate-400">Checking…</p>}
        {phase === 'wrong' && (
          <div>
            <p className="font-semibold text-rose-400">Not quite — try again.</p>
            {hintIdx >= 0 && <p className="mt-1 text-sm text-slate-300">{step.hints[hintIdx]}</p>}
          </div>
        )}
        {phase === 'right' && (
          <div>
            <p className="font-semibold" style={{ color: coach.accent }}>Correct!</p>
            <p className="mt-1 text-sm text-slate-200">{voice || 'Well played — that\'s the move.'}</p>
          </div>
        )}
        {phase === 'complete' && <p className="text-slate-300">{saving ? 'Saving your progress…' : 'Lesson complete.'}</p>}
      </div>

      {phase === 'right' && (
        <div className="mt-4">
          <TrapButton accent={coach.accent} onClick={advance}>
            {stepIdx + 1 < lesson.steps.length ? 'Next ▸' : 'Finish lesson ▸'}
          </TrapButton>
        </div>
      )}
    </div>
  )
}
