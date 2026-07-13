import { NextRequest, NextResponse } from 'next/server'
import { getActiveGameIds } from '@/lib/moves-store'
import { settleGameById } from '@/lib/settle-game'
import { ensureOracleGas } from '@/lib/celo-server'
import { sweepLifecycle } from '@/lib/lifecycle-sweep'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOG_PREFIX = '[api/cron/settle]'
const CHAIN = 'celo' as const

// Skip reasons that are expected steady-state, not failures: a game still in
// progress or abandoned mid-play can't be settled and never will by the oracle
// (abandoned games are cleared by the participant "Reclaim" action instead).
const EXPECTED_SKIPS = new Set(['not-terminal', 'not-active', 'in-progress'])

// GET /api/cron/settle — server-side settlement worker.
// Sweeps every live game and settles the terminal ones, so a finished game is
// always settled even if both players closed their tabs (the client-triggered
// POST is just the fast path). Wire this to a Vercel Cron (see vercel.json).
//
// Self-healing: preflights the oracle's gas and auto-refills from an operator
// wallet if low, because an out-of-gas oracle silently reverts every settlement
// and leaves finished games stuck as "Active" (this happened — games rotted for
// ~2 weeks unnoticed). The response separates expected skips (games in progress /
// abandoned) from real failures so monitoring can alarm on the latter.
//
// Protected by CRON_SECRET. Vercel Cron sends it automatically as a Bearer token;
// a manual call must include `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  try {
    // Preflight: make sure the oracle can pay for settlements before we sweep.
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
    const abandoned: number[] = [] // terminal-impossible; awaiting player Reclaim
    const failed: { gameId: number; reason: string }[] = [] // needs attention

    // Sequential to keep oracle nonces ordered and avoid hammering the RPC.
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

    // v2 lifecycle: close expired wagered lobbies (10-min join window) and void
    // wagered games where nobody ever moved. Never let a lifecycle hiccup fail
    // the settlement sweep — report it and move on.
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
