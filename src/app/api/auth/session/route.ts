import { NextRequest, NextResponse } from 'next/server'
import type { Address } from 'viem'
import { Redis } from '@upstash/redis'
import { verifyWalletSignature } from '@/lib/celo-server'
import {
  SESSION_COOKIE,
  NONCE_TTL_MS,
  issueToken,
  newNonce,
  sessionMessage,
} from '@/lib/game-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let _redis: Redis | null = null
function getRedis(): Redis | null {
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  _redis = new Redis({ url, token })
  return _redis
}

const nonceKey = (n: string) => `chess:sess:nonce:${n}`

// GET /api/auth/session?address=0x… — issue a nonce and the exact text to sign.
//
// The message is built here rather than in the browser so the two can never
// drift out of step; POST rebuilds it from (address, nonce) regardless, so a
// client that signs something else simply fails verification.
export async function GET(req: NextRequest) {
  const redis = getRedis()
  if (!redis) return NextResponse.json({ error: 'session store unavailable' }, { status: 503 })

  const address = req.nextUrl.searchParams.get('address')?.trim()
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 })
  }

  const nonce = newNonce()
  await redis.set(nonceKey(nonce), 1, { px: NONCE_TTL_MS })
  return NextResponse.json({ nonce, message: sessionMessage(address, nonce) })
}

// POST /api/auth/session — exchange a signed nonce for a move-session cookie.
//
// One signature per session, not per move: the popup that 297f5c43 removed does
// not come back. Smart accounts verify through EIP-1271, which verifyWalletSignature
// already handles by reading on-chain.
export async function POST(req: NextRequest) {
  const redis = getRedis()
  if (!redis) return NextResponse.json({ error: 'session store unavailable' }, { status: 503 })

  let body: { address?: string; nonce?: string; signature?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }

  const address = body.address?.trim()
  const nonce = body.nonce?.trim()
  const signature = body.signature?.trim()

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 })
  }
  if (!nonce || !/^[0-9a-f]{32}$/.test(nonce)) {
    return NextResponse.json({ error: 'invalid nonce' }, { status: 400 })
  }
  if (!signature || !/^0x[0-9a-fA-F]+$/.test(signature)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  // Single-use: burn the nonce before verifying, so a replay of the same
  // signature can never mint a second session.
  const burned = await redis.del(nonceKey(nonce))
  if (burned !== 1) {
    return NextResponse.json({ error: 'nonce expired or already used' }, { status: 401 })
  }

  const valid = await verifyWalletSignature(
    address as Address,
    sessionMessage(address, nonce),
    signature as `0x${string}`,
  )
  if (!valid) return NextResponse.json({ error: 'signature does not match address' }, { status: 401 })

  const res = NextResponse.json({ ok: true, address: address.toLowerCase() })
  res.cookies.set(SESSION_COOKIE, issueToken(address), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 6 * 60 * 60,
  })
  return res
}
