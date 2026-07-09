import { NextRequest, NextResponse } from 'next/server'
import {
  recordPlayDay,
  getStreak,
  checkStreakRateLimit,
  type StreakSource,
} from '@/lib/streak-store'

// Sources the client may record. Multiplayer is also credited server-side from
// settlement (settle-game.ts); recording it here too is harmless (idempotent per
// UTC day) and lets the result screen celebrate without waiting on settlement.
//
// NOTE: this endpoint is intentionally unauthenticated (no signature popup) — a
// streak is a vanity counter with no payout attached. When rewards land
// (Phase 3) the bot/puzzle sources MUST become server-validated before any mint.
const CLIENT_SOURCES: StreakSource[] = ['bot', 'puzzle', 'multiplayer']

// ── GET /api/profile/streak?address=0x… — read a wallet's current streak ──
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')
  if (!address?.startsWith('0x')) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 })
  }
  const streak = await getStreak(address)
  return NextResponse.json(streak, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

// ── POST /api/profile/streak — record a completed play (bot / puzzle / multiplayer) ──
export async function POST(request: NextRequest) {
  let body: { address?: string; source?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { address, source } = body

  if (!address?.startsWith('0x')) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 })
  }
  if (!source || !CLIENT_SOURCES.includes(source as StreakSource)) {
    return NextResponse.json({ error: 'invalid source' }, { status: 400 })
  }

  // Light spam guard — recordPlayDay is already idempotent per UTC day.
  const allowed = await checkStreakRateLimit(address)
  if (!allowed) return NextResponse.json({ error: 'too many requests' }, { status: 429 })

  const result = await recordPlayDay(address)
  return NextResponse.json({ ok: true, ...result }, { status: 200 })
}
