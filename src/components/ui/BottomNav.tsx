'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { useWallet } from '@/components/wallet-provider'
import { useStreak } from '@/hooks/useStreak'
import {
  PlayIcon,
  RankIcon,
  HistoryIcon,
  FaucetIcon,
  ProfileIcon,
  FlameIcon,
  type IconProps,
} from '@/components/ui/icons'

type TabDef = {
  key: string
  label: string
  href: string
  match: string[]
  Icon: (p: IconProps) => React.ReactElement
  accent: string
}

const TABS: TabDef[] = [
  { key: 'play', label: 'Play', href: '/app/lobby', match: ['/app/lobby'], Icon: PlayIcon, accent: 'var(--c)' },
  { key: 'ranks', label: 'Ranks', href: '/app/leaderboard', match: ['/app/leaderboard'], Icon: RankIcon, accent: 'var(--candy-amber)' },
  { key: 'profile', label: 'You', href: '/app/profile', match: ['/app/profile'], Icon: ProfileIcon, accent: 'var(--candy-rose)' },
  { key: 'history', label: 'History', href: '/app/history', match: ['/app/history'], Icon: HistoryIcon, accent: 'var(--candy-grape)' },
  { key: 'faucet', label: 'Faucet', href: '/app/faucet', match: ['/app/faucet'], Icon: FaucetIcon, accent: 'var(--candy-lime)' },
]

function Tab({ tab, active, href, streakLabel }: { tab: TabDef; active: boolean; href: string; streakLabel?: string }) {
  const { Icon } = tab
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className="group relative flex flex-1 flex-col items-center justify-center select-none"
      style={{ textDecoration: 'none', WebkitTapHighlightColor: 'transparent', gap: 4, padding: '8px 4px' }}
    >
      {/* Icon chip — the active tab gets a filled rounded chip in its accent;
          the trapezoid motif lives in the chip's slanted lower edge. */}
      <motion.span
        whileTap={{ scale: 0.88 }}
        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
        className="relative flex items-center justify-center"
        style={{
          width: 46,
          height: 34,
          color: active ? tab.accent : 'var(--t3)',
          transition: 'color .2s ease',
        }}
      >
        {/* daily streak badge — always shown on the profile tab ('—' when none) */}
        {streakLabel !== undefined && (
          <span
            className="absolute -top-1 -right-0.5 z-[2] flex items-center gap-0.5 rounded-full px-1.5 py-0.5"
            style={{
              background: 'rgba(8,6,3,0.9)',
              border: '1px solid #ff8a3d',
              color: '#ff8a3d',
              fontFamily: 'var(--fd)',
              fontSize: 9,
              fontWeight: 900,
              lineHeight: 1,
              boxShadow: '0 0 10px rgba(255,138,61,0.4)',
            }}
          >
            <FlameIcon size={9} />
            {streakLabel}
          </span>
        )}
        {active && (
          <motion.span
            layoutId="pc-nav-chip"
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute',
              inset: 0,
              clipPath: 'polygon(8px 0%, calc(100% - 8px) 0%, 100% 100%, 0% 100%)',
              background: `color-mix(in srgb, ${tab.accent} 20%, transparent)`,
              boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${tab.accent} 38%, transparent)`,
              borderRadius: 12,
              willChange: 'transform',
            }}
          />
        )}
        <span className="relative z-[1] flex"><Icon size={26} /></span>
      </motion.span>

      <span
        style={{
          fontFamily: 'var(--fd)',
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: active ? tab.accent : 'var(--t3)',
          transition: 'color .2s ease',
        }}
      >
        {tab.label}
      </span>
    </Link>
  )
}

export default function BottomNav() {
  const pathname = usePathname()
  const { playerAddress } = useWallet()
  const { streak } = useStreak(playerAddress)

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
        gap: 2,
        padding: '6px 8px 0',
        height: 'calc(var(--bottom-nav-h) + 8px + env(safe-area-inset-bottom))',
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
        const href = tab.key === 'profile' ? (playerAddress ? `/app/profile/${playerAddress}` : '/app/lobby') : tab.href
        return <Tab key={tab.key} tab={tab} active={active} href={href} streakLabel={tab.key === 'profile' && streak.current > 0 ? String(streak.current) : undefined} />
      })}
    </nav>
  )
}
