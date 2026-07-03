'use client'

import type React from 'react'
import Link from 'next/link'
import { useProfile } from '@/hooks/useProfile'
import type { ChessProfile } from '@/types/profile'

interface ChessNameProps {
  address: string
  profile?: ChessProfile | null
  badge?: boolean
  short?: boolean
  className?: string
  style?: React.CSSProperties
  asLink?: boolean   // wraps in Link → /app/profile/{address}
}

  const inner = (() => {
    if (isLoading) {
      return (
        <span className={className} style={{ ...style, opacity: 0.5 }}>
          {fmtAddr(address)}
        </span>
      )
    }

export default function ChessName({
  address,
  profile: preloaded,
  badge = false,
  short = false,
  className = '',
  style,
  asLink = false,
}: ChessNameProps) {
  const skip = preloaded !== undefined
  const { data: fetched, isLoading } = useProfile(skip ? null : address)

  const profile = skip ? preloaded : fetched

function fmtAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

    if (!profile) {
      return <span className={className} style={style}>{fmtAddr(address)}</span>
    }

    const display = short ? profile.username : `${profile.username}.chess`

    return (
      <span className={className} style={style}>
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
  })()

  if (asLink) {
    return (
      <Link
        href={`/app/profile/${address}`}
        className="hover:opacity-80 transition-opacity"
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        {inner}
      </Link>
    )
  }

  return inner
}
