import { NextRequest, NextResponse } from 'next/server'
import { getBatchProfiles } from '@/lib/profile-store'

export async function POST(req: NextRequest) {
  let body: any
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
  return NextResponse.json({ profiles })
}
