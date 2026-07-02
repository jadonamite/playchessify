import { NextResponse } from 'next/server'
import { getRecentProfiles } from '@/lib/profile-store'

const getRecentProfilesResponse = async (limit: number) => {
  const profiles = await getRecentProfiles(limit)
  return NextResponse.json({ profiles })
}

export async function GET() {
  return getRecentProfilesResponse(10)
}