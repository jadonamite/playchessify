import { NextRequest, NextResponse, after } from 'next/server'
import { getBatchProfiles } from '@/lib/profile-store'
import { maybeTickBots } from '@/lib/bots/scheduler'

export async function POST(req: NextRequest) {
  let body: { addresses?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { addresses } = body
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return NextResponse.json({ error: 'addresses array required' }, { status: 400 })
  }
  if (addresses.length > 200) {
    return NextResponse.json({ error: 'max 200 addresses per batch' }, { status: 400 })
  }

  const profiles = await getBatchProfiles(addresses)
  // The lobby polls this for player names — the fleet's busiest heartbeat.
  after(() => maybeTickBots())
  return NextResponse.json({ profiles })
}
