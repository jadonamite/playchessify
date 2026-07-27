import { NextRequest, NextResponse } from 'next/server'
import { getProfileByUsername } from '@/lib/profile-store'

type Ctx = { params: Promise<{ username: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { username } = await params
  if (!username) return NextResponse.json({ error: 'invalid username' }, { status: 400 })

  const profile = await getProfileByUsername(username)
  if (!profile) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.json({ profile })
}
// Refactored version
// import { NextRequest, NextResponse } from 'next/server'
// import { getProfileByUsername } from '@/lib/profile-store'
// 
// type Ctx = { params: Promise<{ username: string }> }
// 
// export async function GET(_req: NextRequest, { params }: Ctx) {
//   const { username } = await params
//   if (!username) return NextResponse.json({ error: 'invalid username' }, { status: 400 })
// 
//   const profile = await getProfileByUsername(username)
//   if (!profile) return NextResponse.json({ error: 'not found' }, { status: 404 })
// 
//   return NextResponse.json({ profile })
// }
// becomes
import { NextRequest, NextResponse } from 'next/server'
import { getProfileByUsername } from '@/lib/profile-store'

type Ctx = { params: Promise<{ username: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { username } = await params
  if (!username) return NextResponse.json({ error: 'invalid username' }, { status: 400 })
  const profile = await getProfileByUsername(username)
  if (!profile) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ profile })
}
// No change is actually needed here as the original code is already using guard clauses. The original code is already optimized for this scenario.