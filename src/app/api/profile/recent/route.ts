import { getRecentProfiles } from '@/lib/profile-store'
import { NextResponse } from 'next/server'

export async function GET() {
  const profiles = await getRecentProfiles(10)
  return NextResponse.json({ profiles })
}
