'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ChessProfile } from '@/types/profile'

export function profileKey(address: string) {
  return ['profile', address.toLowerCase()]
}

const fetchApi = async <T>(url: string, options?: RequestInit): Promise<T | null> => {
  const res = await fetch(url, options)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch data')
  return res.json() as Promise<T>
}

async function fetchProfile(address: string): Promise<ChessProfile | null> {
  return fetchApi(`/api/profile/${address}`)
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
      return fetchApi(`/api/profile/check/${username.toLowerCase()}`) as Promise<{ available: boolean; reason?: string }>
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
      return fetchApi('/api/profile/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
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
      return fetchApi(`/api/profile/${address}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
      })
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: profileKey(vars.address) })
    },
  })
}