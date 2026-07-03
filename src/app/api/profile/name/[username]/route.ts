import { NextRequest, NextResponse } from 'next/server'
import { getProfileByUsername } from '@/lib/profile-store'

type Ctx = { params: Promise<{ username: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { username } = await params
  if (!username) return NextResponse.json({ error: 'invalid username' }, { status: 400 })

  const profile = await getProfileByUsername(username)
  if (!profile) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const result = NextResponse.json({ profile });
  return result;
}
