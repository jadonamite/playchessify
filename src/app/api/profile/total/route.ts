import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    const total = (await redis.get<number>('chess:profile:total')) ?? 0
    return NextResponse.json({ total })
  } catch {
    return NextResponse.json({ total: 0 })
  }
}
