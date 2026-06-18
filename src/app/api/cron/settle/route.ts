import { NextRequest, NextResponse } from 'next/server' 
import { getActiveGameIds } from '@/lib/moves-store' 
import { settleGameById } from '@/lib/settle-game' 
export const runtime = 'nodejs' 
export const dynamic = 'force-dynamic' 
const LOG_PREFIX = '[api/cron/settle]' 
const CHAIN = 'celo' as const 
// GET /api/cron/settle — server-side settlement worker. 
// Sweeps every live game and settles the terminal ones, so a finished game is 
// always settled even if both players closed their tabs (the client-triggered 
// POST is just the fast path). Wire this to a Vercel Cron (see vercel.json). 
// 
// Protected by CRON_SECRET. Vercel Cron sends it automatically as a Bearer token; 
// a manual call must include `Authorization: Bearer $CRON_SECRET`. 
export async function GET(req: NextRequest) { 
  const secret = process.env.CRON_SECRET 
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) { 
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 }) 
  } 
  try { 
    const ids = await getActiveGameIds(CHAIN) 
    const settled: number[] = [] 
    const skipped: { gameId: number; reason: string }[] = [] 
    // Sequential to keep oracle nonces ordered and avoid hammering the RPC. 
    for (const gameId of ids) { 
      try { 
        const outcome = await settleGameById(CHAIN, gameId) 
        if (outcome.ok) settled.push(gameId) 
        else skipped.push({ gameId, reason: outcome.reason }) 
      } catch (err) { 
        skipped.push({ gameId, reason: (err as Error)?.message ?? 'error' }) 
      } 
    } 
    return NextResponse.json({ ok: true, scanned: ids.length, settled, skipped }) 
  } catch (err) { 
    console.error(`${LOG_PREFIX} sweep failed`, { err: (err as Error)?.message }) 
    return NextResponse.json({ error: 'sweep failed' }, { status: 503 }) 
  } 
}