import { NextResponse } from 'next/server'
import { getRecentProfiles } from '@/lib/profile-store'

const RECENT_PROFILE_LIMIT = 10

export async function GET() {
  const profiles = await getRecentProfiles(RECENT_PROFILE_LIMIT)
  return NextResponse.json({ profiles })
}