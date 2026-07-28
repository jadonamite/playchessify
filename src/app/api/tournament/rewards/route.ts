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
    if (!prev) return NextResponse.json({ seasonId: 0, winners: [], frozen: true })

    // A dropped Redis read must never look like "you didn't win". Collapsing a
    // failed read into an empty winner list tells a real winner they are not
    // eligible — with claimable money on the line. Retry once, then report the
    // not-yet-frozen state explicitly instead of implying an empty board.
    let final = await getFinalTournament(prev.id)
    if (!final) {
      await new Promise((r) => setTimeout(r, 250))
      final = await getFinalTournament(prev.id)
    }

    if (!final) {
      console.warn('[api/tournament/rewards] no frozen board for', prev.id)
      return NextResponse.json({ seasonId: prev.seasonIndex, winners: [], frozen: false })
    }

    return NextResponse.json({
      seasonId: prev.seasonIndex,
      frozen: true,
      winners: final.winners.map((w) => ({ address: w.address, amount: w.amount })),
    })
  } catch (err) {
    console.error('[api/tournament/rewards] failed:', (err as Error)?.message)
    return NextResponse.json({ error: 'rewards unavailable' }, { status: 503 })
  }
}
