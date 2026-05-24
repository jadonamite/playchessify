'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useWallet } from '@/components/wallet-provider'
import ChessName from '@/components/ui/ChessName'
import ChessAvatar from '@/components/ui/ChessAvatar'
import GlowButton from '@/components/ui/GlowButton'
import ChainSelectModal from '@/components/ui/ChainSelectModal'
import ThemeToggle from '@/components/ui/ThemeToggle'

const NAV_LINKS = [
  { label: 'Leaderboard', path: '/app/leaderboard' },
  { label: 'History',     path: '/app/history' },
  { label: 'Faucet',      path: '/app/faucet' },
  { label: 'Settings',    path: '/app/settings' },
]

export default function Navbar() {
  const {
    isConnected, address,
    connectWallet, disconnectAll,
    showChainSelect, setShowChainSelect,
    connect, connectSocial,
  } = useWallet()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    const close = () => setMobileOpen(false)
    window.addEventListener('resize', close)
    return () => window.removeEventListener('resize', close)
  }, [])

  const showWallet = mounted && isConnected && !!address

  return (
    <>
      <nav style={{
        width: '100%',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'var(--nav-bg)',
        borderBottom: '1px solid var(--nav-border)',
        boxShadow: 'var(--nav-shadow)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 24px',
        }}>

          {/* Logo */}
          <Link href="/" style={{ flexShrink: 0, lineHeight: 0, display: 'block' }}>
            <Image
              src="/chessify.png"
              alt="Chessify"
              width={140}
              height={36}
              priority
              style={{ width: 'clamp(96px, 11vw, 136px)', height: 'auto', objectFit: 'contain' }}
            />
          </Link>

          {/* Desktop center nav — hidden below 768px via CSS */}
          <div className="nav-desktop" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            borderRadius: 999,
            padding: '8px 22px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}>
            {NAV_LINKS.map(({ label, path }) => (
              <Link
                key={label}
                href={path}
                style={{
                  fontFamily: 'var(--fd)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--t2)',
                  textDecoration: 'none',
                  letterSpacing: '.07em',
                  transition: 'color .15s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--c)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--t2)' }}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>

            {/* Theme toggle — desktop only */}
            <div className="nav-desktop">
              <ThemeToggle />
            </div>

            {/* Wallet state — desktop only */}
            {showWallet ? (
              <div className="nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'rgba(53,238,102,0.07)',
                  border: '1px solid rgba(53,238,102,0.18)',
                }}>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#35ee66',
                    boxShadow: '0 0 6px #35ee66',
                    animation: 'pulseDot 2s ease-in-out infinite',
                  }} />
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.16em', color: '#35ee66', fontFamily: 'var(--fd)' }}>CELO</span>
                </div>

                <Link
                  href={`/app/profile/${address}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px 6px 8px',
                    borderRadius: 999,
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    textDecoration: 'none',
                    transition: 'border-color .15s, background .15s',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'rgba(0,204,255,0.35)'
                    el.style.background = 'rgba(0,204,255,0.04)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'rgba(255,255,255,0.09)'
                    el.style.background = 'rgba(0,0,0,0.4)'
                  }}
                >
                  <ChessAvatar address={address} size={20} />
                  <ChessName
                    address={address}
                    short
                    style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)', fontFamily: 'var(--fb)' }}
                  />
                </Link>

                <button
                  onClick={disconnectAll}
                  title="Disconnect"
                  style={{
                    width: 30,
                    height: 30,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    border: '1px solid rgba(255,255,255,0.09)',
                    background: 'rgba(0,0,0,0.35)',
                    color: 'var(--t3)',
                    fontSize: 16,
                    lineHeight: 1,
                    cursor: 'pointer',
                    transition: 'all .15s',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.color = '#f87171'
                    el.style.background = 'rgba(239,68,68,0.1)'
                    el.style.borderColor = 'rgba(239,68,68,0.28)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.color = 'var(--t3)'
                    el.style.background = 'rgba(0,0,0,0.35)'
                    el.style.borderColor = 'rgba(255,255,255,0.09)'
                  }}
                >×</button>
              </div>
            ) : mounted ? (
              <div className="nav-desktop">
                <GlowButton variant="brand" size="sm" onClick={connectWallet}>CONNECT</GlowButton>
              </div>
            ) : <div className="nav-desktop" style={{ width: 92, height: 36 }} />}

            {/* Hamburger — mobile only */}
            <button
              className="nav-mobile"
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.1)',
                background: mobileOpen ? 'rgba(0,204,255,0.08)' : 'rgba(255,255,255,0.04)',
                cursor: 'pointer',
                transition: 'background .15s',
                flexShrink: 0,
              }}
            >
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  display: 'block',
                  width: 18,
                  height: 1.5,
                  borderRadius: 1,
                  background: mobileOpen ? 'var(--c)' : 'var(--t1)',
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
          </div>
        </div>

        {/* Mobile drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div style={{
                padding: '12px 20px 20px',
                background: 'linear-gradient(180deg,rgba(13,13,28,0.99) 0%,rgba(6,6,15,0.99) 100%)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}>
                {NAV_LINKS.map(({ label, path }) => (
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
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--t2)',
                      textDecoration: 'none',
                      letterSpacing: '.06em',
                      transition: 'background .12s, color .12s',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.background = 'rgba(0,204,255,0.06)'
                      el.style.color = 'var(--t1)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.background = 'transparent'
                      el.style.color = 'var(--t2)'
                    }}
                  >
                    <span style={{ color: 'var(--c)', fontSize: 10, fontWeight: 900 }}>›</span>
                    {label}
                  </Link>
                ))}

                {/* Mobile wallet section */}
                <div style={{
                  marginTop: 10,
                  paddingTop: 12,
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                }}>
                  {showWallet ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <Link
                        href={`/app/profile/${address}`}
                        onClick={() => setMobileOpen(false)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flex: 1, minWidth: 0 }}
                      >
                        <ChessAvatar address={address!} size={30} />
                        <div style={{ minWidth: 0 }}>
                          <ChessName
                            address={address!}
                            short
                            style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', display: 'block' }}
                          />
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 2,
                          }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#35ee66' }} />
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#35ee66', letterSpacing: '.1em', fontFamily: 'var(--fd)' }}>CELO</span>
                          </div>
                        </div>
                      </Link>
                      <button
                        onClick={() => { disconnectAll(); setMobileOpen(false) }}
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: '.12em',
                          textTransform: 'uppercase',
                          color: 'rgba(248,113,113,0.65)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'color .15s',
                          padding: '4px 0',
                          flexShrink: 0,
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(248,113,113,0.65)' }}
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <GlowButton variant="brand" fullWidth onClick={() => { connectWallet(); setMobileOpen(false) }}>
                      CONNECT WALLET
                    </GlowButton>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <ChainSelectModal
        isOpen={showChainSelect}
        onClose={() => setShowChainSelect(false)}
        onSelectCelo={connect}
        onSelectSocial={connectSocial}
      />
    </>
  )
}
