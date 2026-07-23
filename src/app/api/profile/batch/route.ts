import { NextRequest, NextResponse, after } from 'next/server'
import { getBatchProfiles } from '@/lib/profile-store'
import { maybeTickBots } from '@/lib/bots/scheduler'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body || !body.addresses || !Array.isArray(body.addresses) || body.addresses.length === 0) {
      return NextResponse.json({ error: 'addresses array required' }, { status: 400 })
    }
    if (body.addresses.length > 200) {
      return NextResponse.json({ error: 'max 200 addresses per batch' }, { status: 400 })
    }

    const profiles = await getBatchProfiles(body.addresses)
    after(() => maybeTickBots())
    return NextResponse.json({ profiles })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'invalid json' }, { status: 400 })
    }
    throw error
  }
}