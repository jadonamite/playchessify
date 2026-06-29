import { NextRequest, NextResponse } from 'next/server'
import { verifyMessage } from 'viem'
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

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { address } = await params
  if (!address?.startsWith('0x')) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 })
  }

  let body: {
    signature?: string
    timestamp?: string
    coachId?: string
    level?: LearnerLevel
    placed?: boolean
    concepts?: Partial<Record<Concept, number>>
    completedLesson?: string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { signature, timestamp } = body
  if (!signature || !timestamp) {
    return NextResponse.json({ error: 'signature and timestamp required' }, { status: 400 })
  }

  // Anti-replay: reject messages older than 5 minutes.
  const ts = new Date(timestamp).getTime()
  if (isNaN(ts) || Date.now() - ts > 5 * 60 * 1000) {
    return NextResponse.json({ error: 'timestamp expired — re-sign and try again' }, { status: 400 })
  }

  const message = `Chessify Training Update\n\nAddress: ${address.toLowerCase()}\nTimestamp: ${timestamp}`
  try {
    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    })
    if (!valid) return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  } catch {
    return NextResponse.json({ error: 'signature verification failed' }, { status: 401 })
  }

  // Rate limit: 60 training updates per address per hour (drills + move feedback).
  const allowed = await checkRateLimit(address, 'update', 60, 3600)
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
