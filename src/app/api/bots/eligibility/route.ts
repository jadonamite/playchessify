import { NextRequest, NextResponse } from 'next/server'
import { humanBotGamesToday } from '@/lib/bots/state'
import { BOT_DAILY_HUMAN_CAP, isBotAddress } from '@/config/bots'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/bots/eligibility?address=0x… — whether this player can still be
// paired with a bot today. Capped players get bot lobbies filtered out of
// their feed (and bots won't join their games), so they never hit a dead end.
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address') ?? ''
  if (!/^0x[a-fA-F0-9]{40}$/.test(address) || isBotAddress(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 })
  }
  try {
    const played = await humanBotGamesToday(address)
    return NextResponse.json({ capped: played >= BOT_DAILY_HUMAN_CAP })
  } catch (err) {
    console.error('[api/bots/eligibility] failed:', (err as Error)?.message)
    // Fail open on the visible side: worst case a capped player sees a bot
    // lobby the fleet will simply never pair them into.
    return NextResponse.json({ capped: false })
  }
}
