'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { useWallet } from '@/components/wallet-provider'
import { useSettingsStore } from '@/hooks/useSettingsStore'
import { stopAmbient } from '@/lib/audio'
import ChessName from '@/components/ui/ChessName'
import ChessAvatar from '@/components/ui/ChessAvatar'
import GlowButton from '@/components/ui/GlowButton'
import {
  PlayIcon,
  RankIcon,
  HistoryIcon,
  FaucetIcon,
  ProfileIcon,
  type IconProps,
} from '@/components/ui/icons'

// Desktop left rail — the signed-in counterpart to the mobile top Navbar +
// BottomNav. It rehomes everything the top nav used to carry (links, music
// toggle, wallet pill + disconnect) into a single Duolingo-style vertical rail.
// Visible only ≥769px via the `.pc-side-nav` helper (see globals.css); below
// that the mobile chrome takes over.

type ItemDef = {
  key: string
  label: string
  href: string
  match: string[]
  Icon: (p: IconProps) => React.ReactElement
  accent: string
}

/**
 * GearIcon
 * @param {*} { size
 * @returns {*}
 */
function GearIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        fill="currentColor"
        opacity="0.35"
      />
      <path
        d="M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M19.4 13a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V19a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 17.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 13a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 7a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 2.6h.05A1.7 1.7 0 0 0 10 1.04V1a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 2.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 7v.05a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(0 1)"
      />
    </svg>
  )
}

const ITEMS: ItemDef[] = [
  { key: 'play', label: 'Play', href: '/app/lobby', match: ['/app/lobby'], Icon: PlayIcon, accent: 'var(--c)' },
  { key: 'ranks', label: 'Ranks', href: '/app/leaderboard', match: ['/app/leaderboard'], Icon: RankIcon, accent: 'var(--candy-amber)' },
  { key: 'history', label: 'History', href: '/app/history', match: ['/app/history'], Icon: HistoryIcon, accent: 'var(--candy-grape)' },
  { key: 'faucet', label: 'Faucet', href: '/app/faucet', match: ['/app/faucet'], Icon: FaucetIcon, accent: 'var(--candy-lime)' },
  { key: 'profile', label: 'You', href: '/app/profile', match: ['/app/profile'], Icon: ProfileIcon, accent: 'var(--candy-rose)' },
  { key: 'settings', label: 'Settings', href: '/app/settings', match: ['/app/settings'], Icon: GearIcon, accent: 'var(--t1)' },
]

function NavRow({ item, active, href }: { item: ItemDef; active: boolean; href: string }) {
  const { Icon } = item
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex items-center gap-3.5 rounded-2xl px-3.5 py-3 select-none transition-colors ${active ? '' : 'hover:bg-white/[0.055]'}`}
      style={{ textDecoration: 'none', color: active ? item.accent : 'var(--t2)', transition: 'color .18s ease' }}
      onMouseEnter={active ? undefined : (e) => { e.currentTarget.style.color = item.accent }}
      onMouseLeave={active ? undefined : (e) => { e.currentTarget.style.color = 'var(--t2)' }}
    >
      {active && (
        <motion.span
          layoutId="pc-side-active"
          transition={{ type: 'spring', stiffness: 520, damping: 40 }}
          className="absolute inset-0 rounded-2xl"
          style={{
            background: `color-mix(in srgb, ${item.accent} 13%, transparent)`,
            boxShadow: `inset 0 0 0 2px color-mix(in srgb, ${item.accent} 42%, transparent)`,
          }}
        />
      )}
      <span className="relative z-[1] flex shrink-0 transition-transform group-hover:scale-110">
        <Icon size={26} />
      </span>
      <span
        className="relative z-[1]"
        style={{
          fontFamily: 'var(--fd)',
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '.06em',
          textTransform: 'uppercase',
        }}
      >
        {item.label}
      </span>
    </Link>
  )
}

export default function SideNav() {
  const pathname = usePathname()
  const { isReady, address, connect, disconnectAll } = useWallet()
  const { soundEnabled, setSoundEnabled } = useSettingsStore()

  const showWallet = isReady && !!address

  return (
    <aside
      className="pc-side-nav"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: 'var(--side-nav-w)',
        zIndex: 50,
        flexDirection: 'column',
        padding: '22px 16px 18px',
        gap: 8,
        background: 'var(--bottom-nav-bg)',
        borderRight: '1px solid var(--bottom-nav-border)',
        boxShadow: '1px 0 0 rgba(255,255,255,.04) inset, 8px 0 28px rgba(0,0,0,.35)',
      }}
    >
      {/* Logo */}
      <Link href="/" style={{ display: 'block', lineHeight: 0, padding: '0 6px 14px' }}>
        <Image
          src="/chessify.png"
          alt="Chessify"
          width={148}
          height={38}
          priority
          style={{ width: 150, height: 'auto', objectFit: 'contain' }}
        />
      </Link>

      {/* Nav items */}
      <nav className="flex flex-col gap-1.5">
        {ITEMS.map((item) => {
          const active = item.match.some((m) => pathname.startsWith(m))
          const href = item.key === 'profile' ? (address ? `/app/profile/${address}` : '/app/lobby') : item.href
          return <NavRow key={item.key} item={item} active={active} href={href} />
        })}
      </nav>

      {/* Footer — music toggle + wallet */}
      <div className="mt-auto flex flex-col gap-3 pt-3" style={{ borderTop: '1px solid var(--bottom-nav-border)' }}>
        <button
          onClick={() => {
            const next = !soundEnabled
            setSoundEnabled(next)
            if (!next) stopAmbient()
          }}
          className="flex items-center gap-3 rounded-xl px-3.5 py-2.5"
          style={{
            fontFamily: 'var(--fd)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.07em',
            color: soundEnabled ? 'var(--c)' : 'var(--t2)',
            background: soundEnabled ? 'color-mix(in srgb, var(--c) 8%, transparent)' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'color .15s, background .15s',
          }}
        >
          <span style={{ fontSize: 15 }}>{soundEnabled ? '♪' : '♩'}</span>
          {soundEnabled ? 'MUSIC ON' : 'MUSIC OFF'}
        </button>

        {showWallet && address ? (
          <div
            className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5"
            style={{ background: 'rgba(0,0,0,.28)', border: '1px solid var(--bottom-nav-border)' }}
          >
            <Link
              href={`/app/profile/${address}`}
              className="flex items-center gap-2.5 min-w-0 flex-1"
              style={{ textDecoration: 'none' }}
            >
              <span className="relative shrink-0">
                <ChessAvatar address={address} size={30} />
                <span
                  className="absolute -bottom-0.5 -right-0.5 block rounded-full"
                  style={{ width: 8, height: 8, background: '#35ee66', boxShadow: '0 0 5px #35ee66', border: '1.5px solid #0b0b1a' }}
                />
              </span>
              <span className="min-w-0">
                <ChessName
                  address={address}
                  short
                  style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', display: 'block', fontFamily: 'var(--fb)' }}
                />
                <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '.14em', color: '#35ee66', fontFamily: 'var(--fd)' }}>
                  CELO
                </span>
              </span>
            </Link>
            <button
              onClick={disconnectAll}
              title="Disconnect"
              aria-label="Disconnect"
              className="shrink-0 rounded-lg p-1.5"
              style={{ color: 'var(--t3)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color .15s, background .15s' }}
              onMouseEnter={(e) => { const el = e.currentTarget; el.style.color = '#f87171'; el.style.background = 'rgba(239,68,68,.1)' }}
              onMouseLeave={(e) => { const el = e.currentTarget; el.style.color = 'var(--t3)'; el.style.background = 'transparent' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        ) : (
          <GlowButton variant="brand" fullWidth onClick={connect}>
            CONNECT
          </GlowButton>
        )}
      </div>
    </aside>
  )
}
