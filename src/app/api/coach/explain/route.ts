import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { coachExplain, type ExplainFacts } from '@/lib/coach/voice'

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
  try {
    const body: ExplainFacts & { fen?: string } = await req.json()
    if (!body.coachName || !body.coachVoice || !body.kind || !body.learnerLevel) {
      return NextResponse.json({ error: 'missing required facts' }, { status: 400 })
    }

    const redis = getRedis()
    if (!redis) return NextResponse.json({ error: 'redis not available' }, { status: 500 })

    const key = cacheKey(body.fen ?? '', body)
    const cached = await redis.get<{ text: string; source: 'llm' | 'template' }>(key)
    if (cached) return NextResponse.json({ ...cached, cached: true })

    const result = await coachExplain(body)
    if (result.source === 'llm') {
      await redis.set(key, result, { ex: 60 * 60 * 24 * 30 })
    }

    return NextResponse.json({ ...result, cached: false })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'invalid json' }, { status: 400 })
    }
    throw error
  }
}