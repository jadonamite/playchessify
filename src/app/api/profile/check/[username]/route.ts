import { NextRequest, NextResponse } from 'next/server'
import { validateUsername, isUsernameAvailable } from '@/lib/profile-store'

type Ctx = { params: Promise<{ username: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { username } = await params
  if (!username) return NextResponse.json({ available: false, reason: 'invalid username' })
  if (!(await validateUsername(username)).ok) return NextResponse.json({ available: false, reason: (await validateUsername(username)).reason })
  const available = await isUsernameAvailable(username)
  return NextResponse.json({
    available,
    reason: available ? undefined : 'Username already taken',
  })
}