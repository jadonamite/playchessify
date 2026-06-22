import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export async function GET() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return NextResponse.json({ total: 0 });
  }

  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    const total = (await redis.get<number>('chess:profile:total')) ?? 0;
    return NextResponse.json({ total });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ total: 0 }, { status: 500 });
  }
}