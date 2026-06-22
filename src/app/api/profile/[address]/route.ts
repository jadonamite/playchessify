import { NextRequest, NextResponse } from 'next/server'
import { verifyMessage } from 'viem'
import {
  getProfileByAddress,
  updateProfile,
  validateUsername,
  checkRateLimit,
} from '@/lib/profile-store'

type Ctx = { params: Promise<{ address: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { address } = await params
  if (!address?.startsWith('0x')) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 })
  }
  const profile = await getProfileByAddress(address)
  if (!profile) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ profile })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { address } = await params
  if (!address?.startsWith('0x')) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 })
  }

  let body: { signature?: string; timestamp?: string; username?: string; displayName?: string; bio?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { signature, timestamp, username, displayName, bio } = body

  if (!signature || !timestamp) {
    return NextResponse.json({ error: 'signature and timestamp required' }, { status: 400 })
  }

  // Anti-replay: reject messages older than 5 minutes
  const ts = new Date(timestamp).getTime()
  if (isNaN(ts) || Date.now() - ts > 5 * 60 * 1000) {
    return NextResponse.json({ error: 'timestamp expired — re-sign and try again' }, { status: 400 })
  }

  const message = `Chessify Profile Update\n\nAddress: ${address.toLowerCase()}\nTimestamp: ${timestamp}`

  try {
    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    })
    if (!valid) return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  } catch {
    return NextResponse.json({ error: 'signature verification failed' }, { status: 401 })
  }

  const allowed = await checkRateLimit(address, 'update', 5, 3600)
  if (!allowed) return NextResponse.json({ error: 'rate limit exceeded' }, { status: 429 })

  // Validate username if provided
  if (username) {
    const check = validateUsername(username)
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 })
  }

  if (displayName && displayName.length > 30) {
    return NextResponse.json({ error: 'displayName max 30 characters' }, { status: 400 })
  }
  if (bio && bio.length > 120) {
    return NextResponse.json({ error: 'bio max 120 characters' }, { status: 400 })
  }

  const result = await updateProfile(address, {
    ...(username ? { username: username.toLowerCase() } : {}),
    ...(displayName !== undefined ? { displayName } : {}),
    ...(bio !== undefined ? { bio } : {}),
  })

  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 409 })
  return NextResponse.json({ ok: true })
}
