import { NextRequest, NextResponse } from 'next/server'
import {
  recordPlayDay,
  recordWinDay,
  getStreak,
  getWinStreak,
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

// ── GET /api/profile/streak?address=0x…[&kind=win] — read a wallet's streak ──
// kind=win reads the daily WIN streak ("stars/Dk); otherwise the play streak.
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  if (!address || !address.startsWith('0x')) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 })
  }

  const kind = req.nextUrl.searchParams.get('kind')
  const streak = kind === 'win' ? await getWinStreak(address) : await getStreak(address)
  return NextResponse.json(streak, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

// ── POST /api/profile/streak — record a completed play, or a win ("star") ──
// body: { address, source, kind?: 'play' | 'win' }. kind=win records the win
// streak; a win is also a play, so the client posts both.
export async function POST(req: NextRequest) {
  try {
    const body: { address?: string; source?: string; kind?: string } = await req.json()
    if (!body.address || !body.address.startsWith('0x')) {
      return NextResponse.json({ error: 'invalid address' }, { status: 400 })
    }
    if (!body.source || !CLIENT_SOURCES.includes(body.source as StreakSource)) {
      return NextResponse.json({ error: 'invalid source' }, { status: 400 })
    }

    // Light spam guard — recordPlayDay/recordWinDay are already idempotent per UTC day.
    const allowed = await checkStreakRateLimit(body.address)
    if (!allowed) return NextResponse.json({ error: 'too many requests' }, { status: 429 })

    const result = body.kind === 'win' ? await recordWinDay(body.address) : await recordPlayDay(body.address)
    return NextResponse.json({ ok: true, ...result }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
}