import { NextResponse } from 'next/server'
import { getLatestConcludedSeason } from '@/config/tournaments'
import { getFinalTournament } from '@/lib/tournament'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/tournament/rewards — the most recently concluded season's frozen
// prize list. Drives the lobby claim banner before (and after) the season is
// seeded on-chain: the whitelist is public the moment the board freezes, even
// while the vault is still waiting to be funded.
export async function GET() {
  try {
    const prev = getLatestConcludedSeason()
    if (!prev) return NextResponse.json({ seasonId: 0, winners: [] })

    try {
      const final = await getFinalTournament(prev.id)
      return NextResponse.json({
        seasonId: prev.seasonIndex,
        winners: (final?.winners ?? []).map((w) => ({ address: w.address, amount: w.amount })),
      })
    } catch (err) {
      console.error('[api/tournament/rewards] failed to fetch final tournament:', (err as Error)?.message)
      return NextResponse.json({ error: 'rewards unavailable' }, { status: 503 })
    }
  } catch (err) {
    console.error('[api/tournament/rewards] failed to fetch latest concluded season:', (err as Error)?.message)
    return NextResponse.json({ error: 'rewards unavailable' }, { status: 503 })
  }
}