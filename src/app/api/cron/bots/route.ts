import { NextRequest, NextResponse } from 'next/server'
import { maybeTickBots } from '@/lib/bots/scheduler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/cron/bots — bot-fleet heartbeat backstop.
// The fleet normally ticks piggybacked on live traffic (after() hooks on the
// busy API routes), so this cron only guarantees a minimum cadence — faucet
// claims and lobby presence — through dead-quiet hours.
//
// Protected by CRON_SECRET, same convention as /api/cron/settle.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  await maybeTickBots()
  return NextResponse.json({ ok: true })
}