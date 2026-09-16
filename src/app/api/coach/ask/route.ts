import { NextRequest, NextResponse } from 'next/server'
import { Chess } from 'chess.js'
import { cookies } from 'next/headers'
import { analyzeOnServer } from '@/lib/analysis/server-engine'
import { coachExplain } from '@/lib/coach/voice'
import { consume, peek, refund, ASKS_PER_GAME } from '@/lib/coach/ask-quota'
import { getCoach } from '@/config/coaches'
import { SESSION_COOKIE, verifyToken } from '@/lib/game-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/coach/ask — buy one opinion from your coach.
 *
 * The reaction layer is free and runs in the browser. This is the thing it
 * makes you want: the coach actually looking at the position and telling you
 * what it thinks. Metered at ASKS_PER_GAME per player per game.
 *
 * The analysis runs HERE, not in the player's tab. That is the whole reason
 * this route exists — a cap over a client-side engine caps nothing.
 *
 * GET with the same query params reads the meter without spending an ask.
 */

interface AskBody {
  /** 'celo:<gameId>' for a real game, 'train:<id>' for a practice board. */
  gameKey?: string
  fen?: string
  coachId?: string
  learnerLevel?: 'basics' | 'intermediate' | 'expert'
  /** The move just played, in SAN, when there is one. */
  lastMoveSan?: string
}

/**
 * Who is asking.
 *
 * A signed move session is the real answer. Without one — a practice board, or
 * a MiniPay wallet that cannot sign at all — fall back to the anonymous cookie
 * the browser already carries. That is weaker, and deliberately so: the asks it
 * guards are free and unwagered, and locking MiniPay users out of coaching to
 * protect a free counter would be the wrong trade.
 */
async function askerFrom(req: NextRequest): Promise<string | null> {
  const jar = await cookies()
  const signed = verifyToken(jar.get(SESSION_COOKIE)?.value)
  if (signed) return signed

  const anon = jar.get('chess_anon')?.value
  if (anon && /^[a-f0-9]{16,64}$/i.test(anon)) return `anon:${anon}`

  // Last resort so a first-time player is not refused outright.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return ip ? `ip:${ip}` : null
}

function validGameKey(k: unknown): k is string {
  return typeof k === 'string' && /^(celo|train):[A-Za-z0-9_-]{1,64}$/.test(k)
}

export async function GET(req: NextRequest) {
  const gameKey = req.nextUrl.searchParams.get('gameKey')
  if (!validGameKey(gameKey)) {
    return NextResponse.json({ error: 'gameKey required' }, { status: 400 })
  }
  const asker = await askerFrom(req)
  if (!asker) return NextResponse.json({ used: 0, limit: ASKS_PER_GAME, remaining: ASKS_PER_GAME })
  return NextResponse.json(await peek(gameKey, asker))
}

export async function POST(req: NextRequest) {
  let body: AskBody
  try {
    body = (await req.json()) as AskBody
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  const { gameKey, fen, coachId, learnerLevel = 'basics', lastMoveSan } = body
  if (!validGameKey(gameKey)) return NextResponse.json({ error: 'gameKey required' }, { status: 400 })
  if (typeof fen !== 'string' || fen.length > 120) {
    return NextResponse.json({ error: 'fen required' }, { status: 400 })
  }

  // Validate the position before spending an ask on it.
  let position: Chess
  try {
    position = new Chess(fen)
  } catch {
    return NextResponse.json({ error: 'illegal fen' }, { status: 400 })
  }
  if (position.isGameOver()) {
    return NextResponse.json({ error: 'the game is over — nothing to ask about' }, { status: 400 })
  }

  const asker = await askerFrom(req)
  if (!asker) return NextResponse.json({ error: 'cannot identify asker' }, { status: 401 })

  const quota = await consume(gameKey, asker)
  if (!quota.ok) {
    return NextResponse.json(
      {
        error: 'out of asks',
        message: `You have used all ${quota.limit} of your questions this game.`,
        ...quota,
      },
      { status: 429 },
    )
  }

  const coach = getCoach(coachId)

  try {
    const analysis = await analyzeOnServer(fen)
    if (!analysis?.bestMove) {
      await refund(gameKey, asker)
      return NextResponse.json({ error: 'analysis unavailable' }, { status: 503 })
    }

    // The engine names the move. The coach only phrases it — the same rule the
    // teaching layer runs on, and the reason an ask can never invent a line.
    let bestSan: string | null = null
    try {
      const probe = new Chess(fen)
      bestSan = probe.move({
        from: analysis.bestMove.slice(0, 2),
        to: analysis.bestMove.slice(2, 4),
        promotion: (analysis.bestMove[4] as 'q' | 'r' | 'b' | 'n') || 'q',
      })?.san ?? null
    } catch { /* keep the UCI move out of the copy rather than guess */ }

    const toMove = position.turn() === 'w' ? 1 : -1
    const advantageCp = analysis.whiteCp * toMove // + = good for whoever is to move

    const { text, source } = await coachExplain({
      coachName: coach.name,
      coachVoice: coach.teaching.voice,
      learnerLevel,
      kind: advantageCp < -150 ? 'blunder' : 'good',
      playerMoveSan: lastMoveSan,
      bestMoveSan: bestSan ?? undefined,
      evalDeltaCp: advantageCp < 0 ? -advantageCp : undefined,
      concept: analysis.mate != null ? 'a forced mate' : undefined,
      detail: `the position is ${describe(advantageCp)} for the side to move`,
    })

    return NextResponse.json({
      text,
      source,
      bestMoveSan: bestSan,
      evalCp: advantageCp,
      mate: analysis.mate,
      depth: analysis.depth,
      ...quota,
    })
  } catch (err) {
    await refund(gameKey, asker)
    console.error('[api/coach/ask] failed:', (err as Error)?.message)
    return NextResponse.json({ error: 'ask failed' }, { status: 500 })
  }
}

function describe(cp: number): string {
  const a = Math.abs(cp)
  const side = cp >= 0 ? 'better' : 'worse'
  if (a < 30) return 'level'
  if (a < 100) return `slightly ${side}`
  if (a < 300) return `clearly ${side}`
  return `much ${side}`
}
