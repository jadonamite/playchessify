'use client'
import { useQuery } from '@tanstack/react-query'
import type { ChessProfile } from '@/types/profile'

const prepareQueryKey = (addresses: string[]) => {
  const sorted = [...addresses].map((a) => a.toLowerCase()).sort()
  return ['profiles-batch', sorted]
}

const fetchBatchProfiles = async (addresses: string[]): Promise<Record<string, ChessProfile | null>> => {
  if (addresses.length === 0) return {}
  const res = await fetch('/api/profile/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ addresses }),
  })
  if (!res.ok) return {}
  const data = await res.json()
  return data.profiles as Record<string, ChessProfile | null>
}

export function useBatchProfiles(addresses: string[]) {
  const queryKey = prepareQueryKey(addresses)
  return useQuery({
    queryKey,
    queryFn: () => fetchBatchProfiles(addresses),
    enabled: addresses.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}