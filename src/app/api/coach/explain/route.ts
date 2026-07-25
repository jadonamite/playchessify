import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { coachExplain, type ExplainFacts } from '@/lib/coach/voice'

/**
 * Coach voice endpoint. Input = engine facts (the caller already ran Stockfish);
 * output = a coach-voiced lesson. Cached in Redis by the fact fingerprint so the
 * same teachable position never re-hits a provider — this also keeps us under
 * the free-tier rate limits. Falls through to the deterministic template when
 * providers are down (handled inside coachExplain).
 */

let _redis: Redis | null = null
function getRedis(): Redis | null {
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  _redis = new Redis({ url, token })
  return _redis
}

function cacheKey(fen: string, f: ExplainFacts): string {
  const sig = [f.coachName, f.learnerLevel, f.kind, f.concept ?? '', f.playerMoveSan ?? '', f.bestMoveSan ?? '', fen].join('|')
  // Cheap stable hash — avoids overly long Redis keys.
  let h = 0
  for (let i = 0; i < sig.length; i++) h = (h * 31 + sig.charCodeAt(i)) | 0
  return `chess:coach:explain:${h >>> 0}`
}

export async function POST(req: NextRequest) {
  let body: ExplainFacts & { fen?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  if (!body.coachName || !body.coachVoice || !body.kind || !body.learnerLevel) {
    return NextResponse.json({ error: 'missing required facts' }, { status: 400 })
  }

  const redis = getRedis()
  const key = redis ? cacheKey(body.fen ?? '', body) : null

  if (redis && key) {
    const cached = await redis.get<{ text: string; source: 'llm' | 'template' }>(key)
    if (cached) return NextResponse.json({ ...cached, cached: true })
  }

  const result = await coachExplain(body)

  // Only cache LLM results (templates are free to recompute and may improve once
  // keys are added).
  if (redis && key && result.source === 'llm') {
    await redis.set(key, result, { ex: 60 * 60 * 24 * 30 })
  }

  return NextResponse.json({ ...result, cached: false })
}
