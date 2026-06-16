'use client'

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
  type DuotoneIconProps,
} from '@/components/ui/icons'

type TabDef = {
  key: string
  label: string
  href: string
  match: string[]
  Icon: (p: DuotoneIconProps) => React.ReactElement
  accent: string
}

const TABS: TabDef[] = [
  { key: 'play', label: 'Play', href: '/app/lobby', match: ['/app/lobby'], Icon: ChessKingIcon, accent: 'var(--c)' },
  { key: 'ranks', label: 'Ranks', href: '/app/leaderboard', match: ['/app/leaderboard'], Icon: RankIcon, accent: 'var(--candy-amber)' },
  { key: 'history', label: 'History', href: '/app/history', match: ['/app/history'], Icon: HistoryIcon, accent: 'var(--candy-grape)' },
  { key: 'faucet', label: 'Faucet', href: '/app/faucet', match: ['/app/faucet'], Icon: DropletIcon, accent: 'var(--candy-lime)' },
  { key: 'profile', label: 'You', href: '/app/profile', match: ['/app/profile'], Icon: UserIcon, accent: 'var(--candy-rose)' },
]

function Tab({ tab, active, href }: { tab: TabDef; active: boolean; href: string }) {
  const { Icon } = tab
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className="relative flex flex-1 flex-col items-center justify-center gap-1 select-none"
      style={{ textDecoration: 'none', WebkitTapHighlightColor: 'transparent', paddingTop: 9 }}
    >
      {/* Trapezoid active indicator — brand slanted-edge motif, slides between tabs */}
      {active && (
        <motion.span
          layoutId="pc-nav-blob"
          transition={{ type: 'spring', stiffness: 520, damping: 38 }}
          style={{
            position: 'absolute',
            top: 6,
            height: 34,
            width: 52,
            zIndex: 0,
            clipPath: 'polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%)',
            background: `color-mix(in srgb, ${tab.accent} 18%, transparent)`,
            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tab.accent} 34%, transparent)`,
          }}
        />
      )}

      <motion.span
        whileTap={{ scale: 0.86 }}
        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
        className="relative z-[1] flex"
        style={{
          color: active ? tab.accent : 'var(--t3)',
          transition: 'color .18s ease',
        }}
      >
        <Icon size={23} />
      </motion.span>

      <span
        className="relative z-[1]"
        style={{
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

  // Hidden during active gameplay — the game screen mounts its own action bar.
  if (pathname.startsWith('/app/game')) return null

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
        const href = tab.key === 'profile' ? (address ? `/app/profile/${address}` : '/app/lobby') : tab.href
        return <Tab key={tab.key} tab={tab} active={active} href={href} />
      })}
    </nav>
  )
}
