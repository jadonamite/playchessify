import { NextRequest, NextResponse } from 'next/server'
import { verifyMessage } from 'viem'
import {
  recordPlayDay,
  getStreak,
  checkStreakRateLimit,
  type StreakSource,
} from '@/lib/streak-store'

// Client-attested sources. Multiplayer is credited server-side from settlement
// (settle-game.ts) and is intentionally NOT accepted here.
const CLIENT_SOURCES: StreakSource[] = ['bot', 'puzzle']

/** Domain-bound message — distinct prefix per intent so a signature captured
 *  for one endpoint can't be replayed against another. */
function streakMessage(source: string, address: string, timestamp: string): string {
  return `Chessify Streak\n\nSource: ${source}\nAddress: ${address}\nTimestamp: ${timestamp}`
}

// ── GET /api/profile/streak?address=0x… — read a wallet's current streak ──
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  if (!address?.startsWith('0x')) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 })
  }
  const streak = await getStreak(address)
  return NextResponse.json(streak, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

// ── POST /api/profile/streak — record a client-attested play (bot / puzzle) ──
export async function POST(req: NextRequest) {
  let body: { address?: string; source?: string; signature?: string; timestamp?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { address, source, signature, timestamp } = body

  if (!address?.startsWith('0x')) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 })
  }
  if (!source || !CLIENT_SOURCES.includes(source as StreakSource)) {
    return NextResponse.json({ error: 'invalid source' }, { status: 400 })
  }
  if (!signature || !timestamp) {
    return NextResponse.json({ error: 'signature and timestamp required' }, { status: 400 })
  }

  // Anti-replay: 5-minute window
  const ts = new Date(timestamp).getTime()
  if (isNaN(ts) || Date.now() - ts > 5 * 60 * 1000) {
    return NextResponse.json({ error: 'timestamp expired — re-sign and try again' }, { status: 400 })
  }

  // Verify wallet ownership (EOA or ERC-1271 smart account, via viem verifyMessage)
  try {
    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message: streakMessage(source, address, timestamp),
      signature: signature as `0x${string}`,
    })
    if (!valid) return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  } catch {
    return NextResponse.json({ error: 'signature verification failed' }, { status: 401 })
  }

  // Light spam guard — recordPlayDay is already idempotent per UTC day.
  const allowed = await checkStreakRateLimit(address)
  if (!allowed) return NextResponse.json({ error: 'too many requests' }, { status: 429 })

  const result = await recordPlayDay(address)
  return NextResponse.json({ ok: true, ...result }, { status: 200 })
}
