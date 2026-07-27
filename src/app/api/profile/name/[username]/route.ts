import { NextRequest, NextResponse } from 'next/server'
import { getProfileByUsername } from '@/lib/profile-store'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  if (!username) return NextResponse.json({ error: 'invalid username' }, { status: 400 })

  const profile = await getProfileByUsername(username)
  if (!profile) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.json({ profile })
}
