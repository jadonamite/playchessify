import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateLearner, updateLearner, checkRateLimit } from '@/lib/train-store'
import type { Concept, LearnerLevel } from '@/types/training'

type Ctx = { params: Promise<{ address: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { address } = await params
  if (!address?.startsWith('0x')) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 })
  }
  const learner = await getOrCreateLearner(address)
  return NextResponse.json({ learner })
}

/**
 * Training progress is low-stakes (which lessons you cleared, concept scores) —
 * it carries no identity or financial weight, so unlike profile updates it is
 * NOT signature-gated. Switching a coach or saving a drill must be instant; a
 * wallet popup on every tap would be terrible UX. A per-address rate limit is
 * the only guard, which is plenty for griefing-only risk.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { address } = await params
  if (!address?.startsWith('0x')) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 })
  }

  let body: {
    coachId?: string
    level?: LearnerLevel
    placed?: boolean
    concepts?: Partial<Record<Concept, number>>
    completedLesson?: string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // Rate limit: 120 training writes per address per hour (covers rapid drills +
  // per-game diagnostics) without ever prompting the user.
  const allowed = await checkRateLimit(address, 'update', 120, 3600)
  if (!allowed) return NextResponse.json({ error: 'rate limit exceeded' }, { status: 429 })

  const learner = await updateLearner(address, {
    coachId: body.coachId,
    level: body.level,
    placed: body.placed,
    concepts: body.concepts,
    completedLesson: body.completedLesson,
  })

  return NextResponse.json({ ok: true, learner })
}
