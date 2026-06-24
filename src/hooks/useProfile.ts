'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ChessProfile } from '@/types/profile'

export function profileKey(address: string) {
  return ['profile', address.toLowerCase()]
}

async function fetchProfile(address: string): Promise<ChessProfile | null> {
  const response = await fetch(`/api/profile/${address}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error('Failed to fetch profile')
  const data = await response.json()
  return data.profile as ChessProfile
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
      const response = await fetch(`/api/profile/check/${username.toLowerCase()}`)
      return response.json() as Promise<{ available: boolean; reason?: string }>
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
      const response = await fetch('/api/profile/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Claim failed')
      return data
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
      const response = await fetch(`/api/profile/${address}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Update failed')
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: profileKey(vars.address) })
    },
  })
}
