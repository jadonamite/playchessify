'use client'

import { useQuery } from '@tanstack/react-query'
import type { ChessProfile } from '@/types/profile'

export function useBatchProfiles(addresses: string[]) {
  const sorted = [...addresses].map((a) => a.toLowerCase()).sort()
  return useQuery({
    queryKey: ['profiles-batch', sorted],
    queryFn: async (): Promise<Record<string, ChessProfile | null>> => {
      if (sorted.length === 0) return {}
      const res = await fetch('/api/profile/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: sorted }),
      })
      if (!res.ok) return {}
      const data = await res.json()
      if (!data || !data.profiles) return {}
      return data.profiles as Record<string, ChessProfile | null>
    },
    enabled: sorted.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
