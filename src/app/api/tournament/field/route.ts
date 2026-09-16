import { NextRequest, NextResponse } from 'next/server'
import { getFieldStatus } from '@/lib/tournament'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/tournament/field?address=0x… — closed-field status for the running
// (or next) event: which Qualifiers gate it, how many seats, and whether this
// wallet holds one.
//
// Separate from /api/tournament/current on purpose: that route rebuilds the
// whole board from chain, which is far too heavy to run per wallet just to
// answer "am I in?". This one only reads the frozen qualifier set.
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')?.trim() || undefined
  if (address && !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 })
  }

  try {
    return NextResponse.json(await getFieldStatus(address))
  } catch (err) {
    console.error('[api/tournament/field] failed:', (err as Error)?.message)
    return NextResponse.json({ error: 'field status unavailable' }, { status: 503 })
  }
}
