'use client'

import type React from 'react'
import Link from 'next/link'
import { useProfile } from '@/hooks/useProfile'
import { useFlagNotice } from '@/components/ui/FlagNotice'
import { InfoCircleIcon } from '@/components/ui/icons'
import type { ChessProfile } from '@/types/profile'

interface ChessNameProps {
  address: string
  profile?: ChessProfile | null
  badge?: boolean
  short?: boolean
  className?: string
  style?: React.CSSProperties
  asLink?: boolean   // wraps in Link → /app/profile/{address}
  /** Terms §7 — flagged for underhanded play; scored on a fixed override, not earned XP. */
  flagged?: boolean
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
  style,
  asLink = false,
  flagged = false,
}: ChessNameProps) {
  const skip = preloaded !== undefined
  const { data: fetched, isLoading } = useProfile(skip ? null : address)

  const profile = skip ? preloaded : fetched
  const showFlagNotice = useFlagNotice((s) => s.show)

  const flagBadge = flagged && (
    <span
      title="Flagged — Terms §7, score is a fixed penalty"
      style={{ marginLeft: '4px', color: '#ef4444', display: 'inline-flex', alignItems: 'center' }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/></svg>
      <button
        type="button"
        aria-label="Why this player is flagged"
        onClick={(e) => {
          // Sits inside the profile Link — keep the tap from navigating.
          e.preventDefault()
          e.stopPropagation()
          showFlagNotice()
        }}
        className="relative inline-flex items-center cursor-pointer after:absolute after:-inset-4 after:content-['']"
        style={{ marginLeft: '3px', color: 'inherit', background: 'none', border: 0, padding: 0 }}
      >
        <InfoCircleIcon size={12} />
      </button>
    </span>
  )

  const inner = (() => {
    if (isLoading) {
      return (
        <span className={className} style={{ ...style, opacity: 0.5 }}>
          {fmtAddr(address)}
          {flagBadge}
        </span>
      )
    }

    if (!profile) {
      return (
        <span className={className} style={style}>
          {fmtAddr(address)}
          {flagBadge}
        </span>
      )
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
        {flagBadge}
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
