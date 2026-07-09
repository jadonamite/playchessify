import { NextRequest, NextResponse } from 'next/server'
import { repairGameHistory, getMoves, type Chain } from '@/lib/moves-store'

export const runtime = 'nodejs'

// Owner-only repair for a game history corrupted by the old relay append race.
// Disabled unless RELAY_ADMIN_SECRET is set; callers must present it.
//
//   curl -X POST https://celo.playchessify.xyz/api/admin/relay/repair \
//     -H 'x-admin-secret: <secret>' -H 'content-type: application/json' \
//     -d '{"gameId":1487}'
//
// GET (same auth) is a dry-run: reports current vs longest-legal length without
// mutating, so you can inspect a stuck game before trimming it.

function authed(req: NextRequest): boolean {
  const secret = process.env.RELAY_ADMIN_SECRET
  if (!secret) return false
  return req.headers.get('x-admin-secret') === secret
}

export async function POST(req: NextRequest) {
  if (!process.env.RELAY_ADMIN_SECRET) {
    return NextResponse.json({ error: 'admin disabled' }, { status: 503 })
  }
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

export async function GET(req: NextRequest) {
  if (!process.env.RELAY_ADMIN_SECRET) {
    return NextResponse.json({ error: 'admin disabled' }, { status: 503 })
  }
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const gameId = parseGameId(req.nextUrl.searchParams.get('gameId'))
  if (gameId === null) return NextResponse.json({ error: 'invalid gameId' }, { status: 400 })

  const moves = await getMoves('celo', gameId)
  return NextResponse.json({ gameId, length: moves.length, moves })
}

function parseGameId(v: unknown): number | null {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

  let body: { gameId?: unknown; chain?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const gameId = parseGameId(body.gameId)
  if (gameId === null) return NextResponse.json({ error: 'invalid gameId' }, { status: 400 })
  const chain = (body.chain === 'celo' || body.chain === undefined ? 'celo' : null) as Chain | null
  if (!chain) return NextResponse.json({ error: 'invalid chain' }, { status: 400 })

  const result = await repairGameHistory(chain, gameId)
  return NextResponse.json({ ok: true, gameId, ...result })
}
