'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ChessProfile } from '@/types/profile'

export function profileKey(address: string) {
  return ['profile', address.toLowerCase()]
}

const handleFetchResponse = async <T>(res: Response) => {
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error ?? 'Request failed')
  }
  return res.json() as Promise<T>
}

async function fetchProfile(address: string): Promise<ChessProfile | null> {
  const res = await fetch(`/api/profile/${address}`)
  if (res.status === 404) return null
  return handleFetchResponse(res)
}

export function useProfile(address: string | null | undefined) {
  return useQuery({
    queryKey: profileKey(address ?? ''),
    queryFn: () => fetchProfile(address!),
    enabled: !!address && address.startsWith('0x'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

export function useCheckUsername(username: string) {
  return useQuery({
    queryKey: ['profile-check', username.toLowerCase()],
    queryFn: async () => {
      if (username.length < 3) return { available: false, reason: 'Too short' }
      const res = await fetch(`/api/profile/check/${username.toLowerCase()}`)
      return handleFetchResponse<{ available: boolean; reason?: string }>(res)
    },
    enabled: username.length >= 3,
    staleTime: 30 * 1000,
    retry: false,
  })
}

export function useClaimProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      address: string
      username: string
      displayName: string
      bio: string
      signature: string
      timestamp: string
    }) => {
      const res = await fetch('/api/profile/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return handleFetchResponse(res)
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: profileKey(vars.address) })
    },
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      address: string
      username?: string
      displayName?: string
      bio?: string
      signature: string
      timestamp: string
    }) => {
      const { address, ...rest } = body
      const res = await fetch(`/api/profile/${address}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
      })
      return handleFetchResponse(res)
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: profileKey(vars.address) })
    },
  })
}