import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export async function GET() {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  if (!redis) {
    return NextResponse.json({ total: 0 });
  }

  try {
    const total = (await redis.get<number>('chess:profile:total')) ?? 0;
    return NextResponse.json({ total });
  } catch (error) {
    console.error('Error fetching total:', error);
    return NextResponse.json({ total: 0 });
  }
}