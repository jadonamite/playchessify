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
        background: 'rgba(6,6,15,0.72)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 28px',
        }}>

          {/* Logo — standalone, far left */}
          <Link href="/" style={{ flexShrink: 0, lineHeight: 0, display: 'block' }}>
            <Image
              src="/chessify.png"
              alt="Chessify"
              width={140}
              height={36}
              priority
              style={{ width: 'clamp(96px, 10vw, 132px)', height: 'auto', objectFit: 'contain' }}
            />
          </Link>

          {/* Right pill — nav links + wallet in one capsule — desktop only */}
          <div className="nav-desktop" style={{
            alignItems: 'center',
            borderRadius: 999,
            background: 'rgba(13,13,26,0.92)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 1px 0 rgba(255,255,255,0.05) inset, 0 12px 40px rgba(0,0,0,0.5)',
          }}>
            {/* Nav links */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px' }}>
              {NAV_LINKS.map(({ label, path }) => (
                <Link
                  key={label}
                  href={path}
                  style={{
                    fontFamily: 'var(--fd)',
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--t3)',
                    textDecoration: 'none',
                    letterSpacing: '.09em',
                    padding: '11px 14px',
                    borderRadius: 999,
                    whiteSpace: 'nowrap',
                    transition: 'color .15s, background .15s',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.color = 'var(--t1)'
                    el.style.background = 'rgba(255,255,255,0.04)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.color = 'var(--t3)'
                    el.style.background = 'transparent'
                  }}
                >
                  {label}
                </Link>
              ))}
            </div>

            {/* Divider */}
            <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

            {/* Wallet section */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px 5px 10px' }}>
              {showWallet ? (
                <>
                  {/* Celo badge */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: 'rgba(53,238,102,0.07)',
                    border: '1px solid rgba(53,238,102,0.14)',
                  }}>
                    <div style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: '#35ee66',
                      boxShadow: '0 0 6px #35ee66',
                      animation: 'pulseDot 2s ease-in-out infinite',
                    }} />
                    <span style={{
                      fontSize: 8,
                      fontWeight: 800,
                      letterSpacing: '.18em',
                      color: '#35ee66',
                      fontFamily: 'var(--fd)',
                    }}>CELO</span>
                  </div>

                  {/* Wallet pill */}
                  <Link
                    href={`/app/profile/${address}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '4px 10px 4px 5px',
                      borderRadius: 999,
                      background: 'rgba(0,204,255,0.06)',
                      border: '1px solid rgba(0,204,255,0.13)',
                      textDecoration: 'none',
                      transition: 'border-color .15s, background .15s',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.borderColor = 'rgba(0,204,255,0.3)'
                      el.style.background = 'rgba(0,204,255,0.1)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.borderColor = 'rgba(0,204,255,0.13)'
                      el.style.background = 'rgba(0,204,255,0.06)'
                    }}
                  >
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

                  {/* Disconnect */}
                  <button
                    onClick={disconnectAll}
                    title="Disconnect"
                    style={{
                      width: 26,
                      height: 26,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--t3)',
                      fontSize: 16,
                      cursor: 'pointer',
                      transition: 'color .15s, background .15s',
                      flexShrink: 0,
                      lineHeight: 1,
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
                  >×</button>
                </>
              ) : mounted ? (
                <GlowButton variant="brand" size="sm" onClick={connectWallet}>CONNECT</GlowButton>
              ) : (
                <div style={{ width: 88, height: 34 }} />
              )}
            </div>
          </div>

          {/* Hamburger — mobile only. No inline display so .nav-mobile CSS controls visibility */}
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
        </div>

        {/* Mobile drawer */}
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
                    <span style={{ color: 'var(--c)', fontSize: 8, opacity: 0.7 }}>◈</span>
                    {label}
                  </Link>
                ))}

                {/* Mobile wallet */}
                <div style={{ marginTop: 10, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#35ee66' }} />
                            <span style={{ fontSize: 8, fontWeight: 700, color: '#35ee66', letterSpacing: '.12em', fontFamily: 'var(--fd)' }}>CELO</span>
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
