'use client'
import Link from 'next/link'
import GlowButton from '@/components/ui/GlowButton'
import Image from 'next/image'

export function FreeCTA() {
  return (
    <section style={{
      padding: '64px 56px', textAlign: 'center',
      background: 'var(--bg)',
      borderTop: '1px solid var(--b1)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 400, height: 200, borderRadius: '50%',
        background: 'radial-gradient(ellipse,rgba(0,204,255,.06),transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', zIndex: 2 }}>
        <p style={{
          fontFamily: 'var(--fd)', fontSize: 10, letterSpacing: '.12em',
          color: 'var(--t3)', marginBottom: 22,
        }}>START FOR FREE</p>
        <Link href="/app/faucet">
          <GlowButton variant="ghost">Get Free CHESS Tokens</GlowButton>
        </Link>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="footer" style={{
      padding: '18px 56px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderTop: '1px solid var(--b1)',
      background: 'var(--bg)',
      flexWrap: 'wrap', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Image src="/chessify.png" alt="Chessify" width={80} height={18} style={{ objectFit: 'contain' }} />
        <span style={{ fontFamily: 'var(--fd)', fontSize: 9, color: 'var(--t3)', letterSpacing: '.06em' }}>
          © 2025 CHESS PROTOCOL
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--t3)', display: 'flex', transition: 'color .2s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--t1)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--t3)' }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
        </a>
        <a
          href="https://twitter.com"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--t3)', display: 'flex', transition: 'color .2s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--t1)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--t3)' }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>
      </div>
    </footer>
  )
}
