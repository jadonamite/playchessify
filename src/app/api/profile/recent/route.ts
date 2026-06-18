import { NextResponse } from 'next/server'
import { getRecentProfiles } from '@/lib/profile-store'

export async function GET() {
  const profiles = await getRecentProfiles(10)
  return NextResponse.json({ profiles })
}
