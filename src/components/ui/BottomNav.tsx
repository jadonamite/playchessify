'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { useWallet } from '@/components/wallet-provider'
import {
  ChessKingIcon,
  RankIcon,
  HistoryIcon,
  DropletIcon,
  UserIcon,
  type AnimatedIconHandle,
} from '@/components/ui/icons'

type TabDef = {
  key: string
  label: string
  href: string
  match: string[]
  Icon: React.ForwardRefExoticComponent<
    React.HTMLAttributes<HTMLDivElement> & { size?: number } & React.RefAttributes<AnimatedIconHandle>
  >
  accent: string
}

const TABS: TabDef[] = [
  { key: 'play', label: 'Play', href: '/app/lobby', match: ['/app/lobby', '/app/game'], Icon: ChessKingIcon, accent: 'var(--c)' },
  { key: 'ranks', label: 'Ranks', href: '/app/leaderboard', match: ['/app/leaderboard'], Icon: RankIcon, accent: 'var(--candy-amber)' },
  { key: 'history', label: 'History', href: '/app/history', match: ['/app/history'], Icon: HistoryIcon, accent: 'var(--candy-grape)' },
  { key: 'faucet', label: 'Faucet', href: '/app/faucet', match: ['/app/faucet'], Icon: DropletIcon, accent: 'var(--candy-lime)' },
  { key: 'profile', label: 'You', href: '/app/profile', match: ['/app/profile'], Icon: UserIcon, accent: 'var(--candy-rose)' },
]

function Tab({
  tab,
  active,
  href,
  onActivate,
}: {
  tab: TabDef
  active: boolean
  href: string
  onActivate: () => void
}) {
  const iconRef = useRef<AnimatedIconHandle>(null)
  const { Icon } = tab

  // Play the icon's signature animation when this tab becomes active.
  useEffect(() => {
    if (active) iconRef.current?.startAnimation()
  }, [active])

  return (
    <Link
      href={href}
      onClick={() => {
        iconRef.current?.startAnimation()
        onActivate()
      }}
      aria-current={active ? 'page' : undefined}
      style={{
        position: 'relative',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        padding: '8px 0 6px',
        textDecoration: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Trapezoid active indicator — preserves the brand slanted-edge motif.
          Slides between tabs via the shared layoutId. */}
      {active && (
        <motion.span
          layoutId="pc-nav-blob"
          transition={{ type: 'spring', stiffness: 480, damping: 34 }}
          style={{
            position: 'absolute',
            top: 4,
            bottom: 4,
            left: 8,
            right: 8,
            zIndex: 0,
            clipPath: 'polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%)',
            background: `color-mix(in srgb, ${tab.accent} 16%, transparent)`,
            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tab.accent} 32%, transparent)`,
          }}
        />
      )}

      <motion.div
        animate={active ? { y: -1, scale: 1 } : { y: 0, scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 420, damping: 22 }}
        style={{
          position: 'relative',
          zIndex: 1,
          color: active ? tab.accent : 'var(--t3)',
          display: 'flex',
          filter: active ? `drop-shadow(0 2px 6px color-mix(in srgb, ${tab.accent} 55%, transparent))` : 'none',
          transition: 'color .18s ease',
        }}
      >
        <Icon ref={iconRef} size={24} />
      </motion.div>

      <span
        style={{
          position: 'relative',
          zIndex: 1,
          fontFamily: 'var(--fd)',
          fontSize: 8.5,
          fontWeight: 700,
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          color: active ? 'var(--t1)' : 'var(--t3)',
          transition: 'color .18s ease',
        }}
      >
        {tab.label}
      </span>
    </Link>
  )
}

export default function BottomNav() {
  const pathname = usePathname()
  const { address } = useWallet()

  return (
    <nav
      className="pc-bottom-nav"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 60,
        alignItems: 'stretch',
        height: 'calc(var(--bottom-nav-h) + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'var(--bottom-nav-bg)',
        borderTop: '1px solid var(--bottom-nav-border)',
        boxShadow: 'var(--bottom-nav-shadow)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {TABS.map((tab) => {
        const active = tab.match.some((m) => pathname.startsWith(m))
        // Profile routes to the connected wallet; falls back to lobby when disconnected.
        const href = tab.key === 'profile' ? (address ? `/app/profile/${address}` : '/app/lobby') : tab.href
        return <Tab key={tab.key} tab={tab} active={active} href={href} onActivate={() => {}} />
      })}
    </nav>
  )
}
