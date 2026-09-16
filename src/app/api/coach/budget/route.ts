import { NextRequest, NextResponse } from 'next/server'
import { getBudget } from '@/lib/coach/budget'
import { paymentsEnabled } from '@/lib/coach/paid-fetch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/coach/budget?coach=<name> — what this coach has left to spend.
//
// The balance is the point, not a diagnostic: an agent with its own money that
// runs out is legible to a player in a way "an AI feature" never is.
export async function GET(req: NextRequest) {
  const coach = req.nextUrl.searchParams.get('coach')?.trim()
  if (!coach || coach.length > 64) {
    return NextResponse.json({ error: 'coach required' }, { status: 400 })
  }
  try {
    return NextResponse.json({ ...(await getBudget(coach)), payments: paymentsEnabled() })
  } catch (err) {
    console.error('[api/coach/budget] failed:', (err as Error)?.message)
    return NextResponse.json({ error: 'budget unavailable' }, { status: 503 })
  }
}
