import { NextRequest, NextResponse } from 'next/server' 
import { type Chain } from '@/lib/moves-store'
import { settleGameById } from '@/lib/settle-game'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOG_PREFIX = '[api/settle]'

function parseChain(value: string): Chain | null {
  return value === 'celo' ? value : null
}

function parseGameId(value: string): number | null {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) return null
  return n
}

// POST /api/games/:chain/:id/settle — replay the game and settle it on-chain.
// Client-triggered; the cron worker is the guaranteed fallback. Idempotent.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ chain: string; id: string }> },
) {
  const { chain: chainRaw, id: idRaw } = await params
  const chain = parseChain(chainRaw)
  const gameId = parseGameId(idRaw)

  if (!chain) return NextResponse.json({ error: 'invalid chain' }, { status: 400 })
  if (gameId === null) return NextResponse.json({ error: 'invalid gameId' }, { status: 400 })

  try {
    const outcome = await settleGameById(chain, gameId)

    if (!outcome.ok) {
      const statusByReason: Record<string, number> = {
        'not-active': 409,
        'in-progress': 409,
        'not-terminal': 400,
        'illegal': 422,
        'forged-signature': 422,
      }
      return NextResponse.json(
        { error: outcome.reason, status: outcome.status },
        { status: statusByReason[outcome.reason] ?? 400 },
      )
    }

    return NextResponse.json({ ok: true, txHash: outcome.txHash, result: outcome.result })
  } catch (err) {
    console.error(`${LOG_PREFIX} POST failed`, { chain, gameId, err: (err as Error)?.message })
    return NextResponse.json({ error: 'settlement failed' }, { status: 503 })
  }
}