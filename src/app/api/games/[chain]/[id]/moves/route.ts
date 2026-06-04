import { NextRequest, NextResponse } from 'next/server'
import { appendMove, getMoves, type Chain, type MoveRecord } from '@/lib/moves-store'

const LOG_PREFIX = '[api/moves]'

function parseChain(value: string): Chain | null {
  return value === 'celo' ? value : null
}

function parseGameId(value: string): number | null {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) return null
  return n
}

// GET /api/games/:chain/:id/moves — fetch the full move history
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ chain: string; id: string }> }
) {
  const { chain: chainRaw, id: idRaw } = await params
  const chain = parseChain(chainRaw)
  const gameId = parseGameId(idRaw)

  if (!chain) return NextResponse.json({ error: 'invalid chain' }, { status: 400 })
  if (gameId === null) return NextResponse.json({ error: 'invalid gameId' }, { status: 400 })

  try {
    const moves = await getMoves(chain, gameId)
    return NextResponse.json({ moves })
  } catch (err) {
    console.error(`${LOG_PREFIX} GET failed`, { chain, gameId, err: (err as Error)?.message })
    return NextResponse.json({ error: 'relay unavailable' }, { status: 503 })
  }
}

// POST /api/games/:chain/:id/moves — append a move
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chain: string; id: string }> }
) {
  const { chain: chainRaw, id: idRaw } = await params
  const chain = parseChain(chainRaw)
  const gameId = parseGameId(idRaw)

  if (!chain) return NextResponse.json({ error: 'invalid chain' }, { status: 400 })
  if (gameId === null) return NextResponse.json({ error: 'invalid gameId' }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }

  const san = typeof body?.san === 'string' ? body.san.trim() : ''
  const player = typeof body?.player === 'string' ? body.player.trim() : ''
  const moveNumber = Number(body?.moveNumber)

  if (!san || san.length > 16) {
    return NextResponse.json({ error: 'invalid san' }, { status: 400 })
  }
  if (!player || player.length > 64) {
    return NextResponse.json({ error: 'invalid player' }, { status: 400 })
  }
  if (!Number.isInteger(moveNumber) || moveNumber <= 0) {
    return NextResponse.json({ error: 'invalid moveNumber' }, { status: 400 })
  }

  const record: MoveRecord = { san, player, moveNumber, ts: Date.now() }

  try {
    // Race-protect: only accept this move if it lands at the expected position.
    // Two simultaneous POSTs both targeting moveNumber N: one wins, one is rejected.
    const existing = await getMoves(chain, gameId)
    if (existing.length >= moveNumber) {
      return NextResponse.json(
        { error: 'move number already recorded', moves: existing },
        { status: 409 }
      )
    }

    const newLen = await appendMove(chain, gameId, record)
    return NextResponse.json({ ok: true, moveCount: newLen, move: record })
  } catch (err) {
    console.error(`${LOG_PREFIX} POST failed`, { chain, gameId, err: (err as Error)?.message })
    return NextResponse.json({ error: 'relay unavailable' }, { status: 503 })
  }
}
