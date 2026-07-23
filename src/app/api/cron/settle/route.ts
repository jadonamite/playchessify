import { NextRequest, NextResponse } from 'next/server'
import { getActiveGameIds } from '@/lib/moves-store'
import { settleGameById } from '@/lib/settle-game'
import { ensureOracleGas } from '@/lib/celo-server'
import { sweepLifecycle } from '@/lib/lifecycle-sweep'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOG_PREFIX = '[api/cron/settle]'
const CHAIN = 'celo' as const

const EXPECTED_SKIPS = new Set(['not-terminal', 'not-active', 'in-progress'])

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const oracle = await ensureOracleGas()
    if (!oracle.ok) {
      console.error(`${LOG_PREFIX} oracle cannot settle — sweep aborted`, oracle)
      return NextResponse.json(
        { ok: false, reason: 'oracle-out-of-gas', oracle },
        { status: 503 },
      )
    }

    const ids = await getActiveGameIds(CHAIN)
    const settled: number[] = []
    const abandoned: number[] = []
    const failed: { gameId: number; reason: string }[] = []

    for (const gameId of ids) {
      try {
        const outcome = await settleGameById(CHAIN, gameId)
        if (outcome.ok) settled.push(gameId)
        else if (EXPECTED_SKIPS.has(outcome.reason)) abandoned.push(gameId)
        else failed.push({ gameId, reason: outcome.reason })
      } catch (err) {
        failed.push({ gameId, reason: (err as Error)?.message ?? 'error' })
      }
    }

    if (failed.length > 0) {
      console.error(`${LOG_PREFIX} settlements need attention`, { failed })
    }

    let lifecycle: Awaited<ReturnType<typeof sweepLifecycle>> | { error: string }
    try {
      lifecycle = await sweepLifecycle(CHAIN)
    } catch (err) {
      lifecycle = { error: (err as Error)?.message ?? 'lifecycle sweep failed' }
      console.error(`${LOG_PREFIX} lifecycle sweep failed`, lifecycle)
    }

    return NextResponse.json({
      ok: true,
      oracle,
      scanned: ids.length,
      settled,
      abandonedInProgress: abandoned.length,
      failed,
      lifecycle,
    })
  } catch (err) {
    console.error(`${LOG_PREFIX} sweep failed`, { err: (err as Error)?.message })
    return NextResponse.json({ error: 'sweep failed' }, { status: 503 })
  }
}