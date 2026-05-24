'use client'

import { useProfile } from '@/hooks/useProfile'
import type { ChessProfile } from '@/types/profile'

interface ChessNameProps {
  address: string
  profile?: ChessProfile | null   // pre-loaded (skips fetch)
  badge?: boolean                  // show ✦ OG badge
  short?: boolean                  // show "jadon" instead of "jadon.chess"
  className?: string
}

function fmtAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export default function ChessName({
  address,
  profile: preloaded,
  badge = false,
  short = false,
  className = '',
}: ChessNameProps) {
  const skip = preloaded !== undefined
  const { data: fetched, isLoading } = useProfile(skip ? null : address)

  const profile = skip ? preloaded : fetched

  if (isLoading) {
    return (
      <span className={className} style={{ opacity: 0.5 }}>
        {fmtAddr(address)}
      </span>
    )
  }

  if (!profile) {
    return <span className={className}>{fmtAddr(address)}</span>
  }

  const display = short ? profile.username : `${profile.username}.chess`

  return (
    <span className={className}>
      {display}
      {badge && profile.og && (
        <span
          title="OG — first 100 players"
          style={{ marginLeft: '4px', color: '#fbbf24', fontSize: '0.75em' }}
        >
          ✦
        </span>
      )}
    </span>
  )
}
