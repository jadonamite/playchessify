'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useWallet } from '@/components/wallet-provider'
import ChessName from '@/components/ui/ChessName'
import ChessAvatar from '@/components/ui/ChessAvatar'
import GlowButton from '@/components/ui/GlowButton'
import CoachNavIcon from '@/components/ui/CoachNavIcon'
import { FlameIcon } from '@/components/ui/icons'
import { useSettingsStore } from '@/hooks/useSettingsStore'
import { useStreak } from '@/hooks/useStreak'
import { stopAmbient } from '@/lib/audio'

const NAV_LINKS = [
  { label: 'Leaderboard', path: '/app/leaderboard' },
  { label: 'History',     path: '/app/history' },
  { label: 'Faucet',      path: '/app/faucet' },
  { label: 'Settings',    path: '/app/settings' },
]

// On mobile the bottom nav owns Play/Ranks/History/Faucet/Profile, so the
// hamburger drawer only needs the overflow items not covered there (Settings).
const MOBILE_DRAWER_LINKS = NAV_LINKS.filter((l) => l.path === '/app/settings')

function LogoutIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

/**
 * Navbar
 * @returns {*}
 */
export default function Navbar() {
  const {
    isReady, address, playerAddress,
    disconnectAll,
    connect,
  } = useWallet()

  const { soundEnabled, setSoundEnabled } = useSettingsStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration mount flag
  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    const close = () => setMobileOpen(false)
    window.addEventListener('resize', close)
    return () => window.removeEventListener('resize', close)
  }, [])

  const showWallet = mounted && isReady && !!address
  const profileAddr = playerAddress ?? address
  const { streak } = useStreak(profileAddr)

  return (
    <>
      <nav style={{
        width: '100%',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(6,6,15,0.95)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255,255,255,0.055)',
      }}>
        {/* ── Main bar ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 58,
          padding: '0 clamp(14px,4vw,28px)',
          position: 'relative',
        }}>

          {/* Logo — bare, far left */}
          <Link href="/" style={{ flexShrink: 0, lineHeight: 0, display: 'block', position: 'relative', zIndex: 2 }}>
            <Image
              src="/chessify.png"
              alt="Chessify"
              width={140}
              height={36}
              priority
              style={{ width: 'clamp(112px, 11vw, 148px)', height: 'auto', objectFit: 'contain' }}
            />
          </Link>

          {/* Trapezoid — centered, hugs the top edge, desktop only */}
          <div
            className="nav-desktop"
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              height: '100%',
              alignItems: 'center',
              padding: '0 44px',
              gap: 0,
              /* wider at top (flush with nav top), tapers at bottom */
              clipPath: 'polygon(0% 0%, 100% 0%, calc(100% - 22px) 100%, 22px 100%)',
              background: 'rgba(255,255,255,0.042)',
              filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.09))',
              zIndex: 1,
            }}
          >
            {NAV_LINKS.map(({ label, path }, i) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center' }}>
                <Link
                  href={path}
                  style={{
                    fontFamily: 'var(--fd)',
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--t2)',
                    textDecoration: 'none',
                    letterSpacing: '.09em',
                    padding: '0 18px',
                    whiteSpace: 'nowrap',
                    transition: 'color .15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--c)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--t2)' }}
                >
                  {label}
                </Link>
                {i < NAV_LINKS.length - 1 && (
                  <span style={{
                    color: 'rgba(255,255,255,0.14)',
                    fontSize: 11,
                    lineHeight: 1,
                    userSelect: 'none',
                    pointerEvents: 'none',
                  }}>|</span>
                )}
              </span>
            ))}
          </div>

          {/* Right — parallelogram wallet/connect + mobile hamburger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 2 }}>

            {/* Music toggle — desktop */}
            {mounted && (
              <button
                className="nav-desktop"
                onClick={() => {
                  const next = !soundEnabled
                  setSoundEnabled(next)
                  if (!next) stopAmbient()
                }}
                title={soundEnabled ? 'Mute music' : 'Play music'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: `1px solid ${soundEnabled ? 'rgba(0,204,255,0.22)' : 'rgba(255,255,255,0.08)'}`,
                  background: soundEnabled ? 'rgba(0,204,255,0.06)' : 'rgba(255,255,255,0.03)',
                  color: soundEnabled ? 'var(--c)' : 'var(--t3)',
                  cursor: 'pointer',
                  transition: 'all .15s',
                  flexShrink: 0,
                  fontSize: 14,
                }}
              >
                {soundEnabled ? '♪' : '♩'}
              </button>
            )}

            {/* Desktop: wallet parallelogram or connect button */}
            <div className="nav-desktop" style={{ display: 'flex', alignItems: 'center' }}>
              {showWallet ? (
                /* Connected — parallelogram pill */
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  clipPath: 'polygon(14px 0%, 100% 0%, calc(100% - 14px) 100%, 0% 100%)',
                  background: 'rgba(0,204,255,0.07)',
                  border: 'none',
                }}>
                  {/* Profile link area */}
                  <Link
                    href={`/app/profile/${profileAddr}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '10px 14px 10px 22px',
                      textDecoration: 'none',
                      transition: 'background .15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,204,255,0.07)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <div style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: '#35ee66',
                      boxShadow: '0 0 5px #35ee66',
                      flexShrink: 0,
                      animation: 'pulseDot 2s ease-in-out infinite',
                    }} />
                    <ChessAvatar address={address} size={18} />
                    <ChessName
                      address={address}
                      short
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--t1)',
                        fontFamily: 'var(--fb)',
                        letterSpacing: '.02em',
                      }}
                    />
                  </Link>

                  {/* Thin divider */}
                  <div style={{ width: 1, height: 18, background: 'rgba(0,204,255,0.18)', flexShrink: 0 }} />

                  {/* Logout icon button */}
                  <button
                    onClick={disconnectAll}
                    title="Disconnect"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '10px 20px 10px 13px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--t3)',
                      cursor: 'pointer',
                      transition: 'color .15s, background .15s',
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.color = '#f87171'
                      el.style.background = 'rgba(239,68,68,0.1)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.color = 'var(--t3)'
                      el.style.background = 'transparent'
                    }}
                  >
                    <LogoutIcon />
                  </button>
                </div>
              ) : mounted ? (
                <GlowButton
                  variant="brand"
                  parallelogram
                  onClick={connect}
                  style={{ padding: '10px 28px', fontSize: '11px' }}
                >
                  CONNECT
                </GlowButton>
              ) : (
                <div style={{ width: 110, height: 38 }} />
              )}
            </div>

            {/* Coach avatar — mobile, beside the streak. Always shown when signed
                in; routes to training. Shows the "pick a coach" wiggle when none. */}
            {showWallet && (
              <Link href="/app/train" aria-label="Your coach" className="nav-mobile"
                    style={{ alignItems: 'center', flexShrink: 0, textDecoration: 'none' }}>
                <CoachNavIcon size={30} />
              </Link>
            )}

            {/* Streak chip — mobile, beside the hamburger (only with a live streak) */}
            {showWallet && streak.current > 0 && (
              <Link
                href={`/app/profile/${profileAddr}`}
                aria-label={`${streak.current} day streak`}
                className="nav-mobile"
                style={{
                  alignItems: 'center',
                  gap: 4,
                  height: 36,
                  padding: '0 10px',
                  borderRadius: 10,
                  border: '1px solid #ff8a3d',
                  background: 'rgba(255,138,61,0.08)',
                  color: '#ff8a3d',
                  textDecoration: 'none',
                  fontFamily: 'var(--fd)',
                  fontWeight: 900,
                  fontSize: 13,
                  lineHeight: 1,
                  flexShrink: 0,
                  boxShadow: '0 0 12px rgba(255,138,61,0.25)',
                }}
              >
                <FlameIcon size={16} />
                {streak.current}
              </Link>
            )}

            {/* Mobile hamburger — no inline display so .nav-mobile CSS controls it */}
            <button
              className="nav-mobile"
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
              style={{
                width: 36,
                height: 36,
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                borderRadius: 10,
                border: `1px solid ${mobileOpen ? 'rgba(0,204,255,0.28)' : 'rgba(255,255,255,0.09)'}`,
                background: mobileOpen ? 'rgba(0,204,255,0.07)' : 'rgba(255,255,255,0.03)',
                cursor: 'pointer',
                transition: 'background .15s, border-color .15s',
                flexShrink: 0,
              }}
            >
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  display: 'block',
                  width: 18,
                  height: 1.5,
                  borderRadius: 1,
                  background: mobileOpen ? 'var(--c)' : 'var(--t2)',
                  transition: 'transform .2s ease, opacity .15s, background .15s',
                  transformOrigin: 'center',
                  transform: mobileOpen
                    ? i === 0 ? 'translateY(6.5px) rotate(45deg)'
                    : i === 2 ? 'translateY(-6.5px) rotate(-45deg)'
                    : 'scaleX(0)'
                    : 'none',
                  opacity: mobileOpen && i === 1 ? 0 : 1,
                }} />
              ))}
            </button>

            {/* Music toggle — always visible on mobile, next to hamburger */}
            {mounted && (
              <button
                className="nav-mobile"
                onClick={() => {
                  const next = !soundEnabled
                  setSoundEnabled(next)
                  if (!next) stopAmbient()
                }}
                title={soundEnabled ? 'Mute music' : 'Play music'}
                aria-label={soundEnabled ? 'Mute music' : 'Play music'}
                style={{
                  width: 36,
                  height: 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 10,
                  border: `1px solid ${soundEnabled ? 'rgba(0,204,255,0.22)' : 'rgba(255,255,255,0.08)'}`,
                  background: soundEnabled ? 'rgba(0,204,255,0.06)' : 'rgba(255,255,255,0.03)',
                  color: soundEnabled ? 'var(--c)' : 'var(--t3)',
                  cursor: 'pointer',
                  transition: 'all .15s',
                  flexShrink: 0,
                  fontSize: 15,
                }}
              >
                {soundEnabled ? '♪' : '♩'}
              </button>
            )}
          </div>
        </div>

        {/* ── Mobile drawer ── */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div style={{
                padding: '10px 20px 20px',
                background: 'rgba(8,8,20,0.98)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}>
                {/* Music toggle — mobile */}
                <button
                  onClick={() => {
                    const next = !soundEnabled
                    setSoundEnabled(next)
                    if (!next) stopAmbient()
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '11px 14px',
                    borderRadius: 12,
                    fontFamily: 'var(--fd)',
                    fontSize: 11,
                    fontWeight: 600,
                    color: soundEnabled ? 'var(--c)' : 'var(--t2)',
                    background: soundEnabled ? 'rgba(0,204,255,0.05)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    letterSpacing: '.07em',
                    transition: 'background .12s, color .12s',
                    width: '100%',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 14 }}>{soundEnabled ? '♪' : '♩'}</span>
                  {soundEnabled ? 'MUSIC ON' : 'MUSIC OFF'}
                </button>

                {MOBILE_DRAWER_LINKS.map(({ label, path }) => (
                  <Link
                    key={label}
                    href={path}
                    onClick={() => setMobileOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '11px 14px',
                      borderRadius: 12,
                      fontFamily: 'var(--fd)',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--t2)',
                      textDecoration: 'none',
                      letterSpacing: '.07em',
                      transition: 'background .12s, color .12s',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.background = 'rgba(0,204,255,0.05)'
                      el.style.color = 'var(--t1)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.background = 'transparent'
                      el.style.color = 'var(--t2)'
                    }}
                  >
                    <span style={{ color: 'var(--c)', fontSize: 8, opacity: 0.6 }}>◈</span>
                    {label}
                  </Link>
                ))}

                <div style={{ marginTop: 10, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  {showWallet ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <Link
                        href={`/app/profile/${profileAddr}`}
                        onClick={() => setMobileOpen(false)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flex: 1, minWidth: 0 }}
                      >
                        <ChessAvatar address={profileAddr!} size={30} />
                        <div style={{ minWidth: 0 }}>
                          <ChessName address={profileAddr!} short style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', display: 'block' }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#35ee66' }} />
                            <span style={{ fontSize: 8, fontWeight: 700, color: '#35ee66', letterSpacing: '.12em', fontFamily: 'var(--fd)' }}>CELO</span>
                          </div>
                        </div>
                      </Link>
                      <button
                        onClick={() => { disconnectAll(); setMobileOpen(false) }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: '.1em',
                          textTransform: 'uppercase',
                          color: 'rgba(248,113,113,0.55)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'color .15s',
                          padding: '4px 0',
                          flexShrink: 0,
                          fontFamily: 'var(--fd)',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(248,113,113,0.55)' }}
                      >
                        <LogoutIcon />
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <GlowButton variant="brand" fullWidth onClick={() => { connect(); setMobileOpen(false) }}>
                      CONNECT WALLET
                    </GlowButton>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

    </>
  )
}
