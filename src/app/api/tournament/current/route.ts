import { NextResponse } from 'next/server'
import { getCurrentTournament } from '@/lib/tournament'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/tournament/current — the live season's window + XP-scored board and
// prize standings. Seeds ratings lazily on first read after open and freezes the
// prior season's final board opportunistically. Payout stays manual: this endpoint
// only reports who is winning.
export async function GET() {
  try {
    const data = await getCurrentTournament()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/tournament/current] failed:', (err as Error)?.message)
    return NextResponse.json({ error: 'tournament unavailable' }, { status: 503 })
  }
}
