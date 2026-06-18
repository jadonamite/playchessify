'use client'

export default function Features() {
  return (
    <section id="how-it-works" className="features-section" style={{ padding: '80px 56px', background: 'var(--bg)' }}>

const tagStyle = (bg: string, border: string, color: string): React.CSSProperties => ({
  fontFamily: 'var(--fd)', fontSize: 9, letterSpacing: '.12em',
  borderRadius: 999, padding: '4px 12px', display: 'inline-block',
  marginBottom: 13, background: bg, border: `1px solid ${border}`, color,
})

const descStyle: React.CSSProperties = {
  fontSize: 13.5, color: 'var(--t2)', lineHeight: 1.65, fontWeight: 300,
}

const hoverOn = (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.transform = 'translateY(-5px) scale(1.006)' }
const hoverOff = (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.transform = '' }

/* ── Watermark icon: stroke-only, tiny, constrained by wrapper ── */
function BgIcon({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'absolute',
      bottom: '-6%',
      right: '-4%',
      width: '58%',
      aspectRatio: '1',
      opacity: 0.07,
      pointerEvents: 'none',
      transition: 'opacity .3s',
      overflow: 'hidden',
    }}>
      {children}
    </div>
  )
}

const cardBase: React.CSSProperties = {
  borderRadius: 24, position: 'relative', overflow: 'hidden',
  cursor: 'default', transition: 'transform .3s cubic-bezier(.34,1.56,.64,1)',
}

const pillStyle = (bg: string, border: string, color: string): React.CSSProperties => ({
  fontFamily: 'var(--fd)', fontSize: 10, fontWeight: 600,
  padding: '7px 17px', borderRadius: 999, display: 'inline-block',
  marginTop: 12, marginRight: 7,
  background: bg, border: `1px solid ${border}`, color,
  boxShadow: '0 2px 0 rgba(255,255,255,.1) inset, 0 -1px 0 rgba(0,0,0,.3) inset',
})

const innerStyle: React.CSSProperties = {
  padding: '28px 30px', position: 'relative', zIndex: 2,
  height: '100%', display: 'flex', flexDirection: 'column',
}

const titleStyle = (color: string, size = 18): React.CSSProperties => ({
  fontFamily: 'var(--fd)', fontWeight: 800, fontSize: size,
  color, lineHeight: 1.05, letterSpacing: '-.02em', marginBottom: 9,
})

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 54 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          background: 'linear-gradient(145deg,rgba(160,100,255,.12),rgba(160,100,255,.05))',
          border: '1px solid rgba(160,100,255,.22)', borderRadius: 999,
          padding: '6px 18px', marginBottom: 18,
        }}>
          <span style={{ fontFamily: 'var(--fd)', fontSize: 9, fontWeight: 600, color: '#c090ff', letterSpacing: '.15em' }}>WHY CHESSIFY</span>
        </div>
        <h2 style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 'clamp(28px,3.5vw,44px)', lineHeight: 1.06, letterSpacing: '-.03em', marginBottom: 14, color: 'var(--t1)' }}>
          Chess, rewired<br /><span style={{ color: 'var(--c)' }}>for the chain</span>
        </h2>
        <p style={{ fontSize: 15, color: 'var(--t2)', maxWidth: 400, margin: '0 auto', lineHeight: 1.7, fontWeight: 300 }}>
          Real stakes, verifiable moves, and permanent on-chain reputation.
        </p>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Row 1 */}
        <div className="features-row-1" style={{ display: 'grid', gridTemplateColumns: '1.65fr 1fr', gap: 14 }}>

          {/* Purple: Real Wagers */}
          <div
            style={{
              ...cardBase, minHeight: 290,
              background: 'linear-gradient(135deg,#18093a,#0c0520)',
              border: '1px solid rgba(160,100,255,.24)',
              boxShadow: '0 2px 0 rgba(180,120,255,.14) inset, 0 -2px 0 rgba(0,0,0,.7) inset, 0 24px 60px rgba(120,60,220,.22)',
            }}
            onMouseEnter={hoverOn} onMouseLeave={hoverOff}
          >
            <BgIcon>
              <svg viewBox="0 0 24 24" fill="none" width="100%" height="100%">
                <circle cx="12" cy="12" r="10" stroke="rgba(160,100,255,.9)" strokeWidth="1.5" />
                <path d="M12 3a9 9 0 0 1 9 9" stroke="rgba(160,100,255,.9)" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="12" r="3.5" stroke="rgba(160,100,255,.9)" strokeWidth="1.2" />
                <line x1="12" y1="12" x2="17.5" y2="8.5" stroke="rgba(160,100,255,.9)" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </BgIcon>
            <div style={{ ...innerStyle, justifyContent: 'space-between' }}>
              <div>
                <span style={tagStyle('rgba(160,100,255,.15)', 'rgba(160,100,255,.28)', '#c090ff')}>CORE FEATURE</span>
                <div style={titleStyle('#c090ff', 23)}>Real Wagers</div>
                <div style={descStyle}>Stake CHESS tokens before each game. Winner takes the full pot — on-chain, instant, zero middlemen.</div>
              </div>
              <div style={{ display: 'flex', gap: 22, paddingTop: 18, marginTop: 18, borderTop: '1px solid rgba(255,255,255,.07)' }}>
                {[{ v: '2×', l: 'PAYOUT' }, { v: '0%', l: 'FEES' }, { v: '∞', l: 'GAMES' }].map(m => (
                  <div key={m.l}>
                    <div style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 28, color: '#c090ff' }}>{m.v}</div>
                    <div style={{ fontFamily: 'var(--fd)', fontSize: 8, color: 'var(--t3)', letterSpacing: '.13em', marginTop: 3 }}>{m.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cyan: On-chain */}
          <div
            style={{
              ...cardBase, minHeight: 290,
              background: 'linear-gradient(135deg,#031624,#010810)',
              border: '1px solid rgba(0,204,255,.26)',
              boxShadow: '0 2px 0 rgba(0,204,255,.16) inset, 0 -2px 0 rgba(0,0,0,.7) inset, 0 24px 60px rgba(0,180,240,.18)',
            }}
            onMouseEnter={hoverOn} onMouseLeave={hoverOff}
          >
            <BgIcon>
              <svg viewBox="0 0 24 24" fill="none" width="100%" height="100%">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="rgba(0,204,255,.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </BgIcon>
            <div style={{ ...innerStyle, justifyContent: 'flex-end' }}>
              <span style={tagStyle('rgba(0,204,255,.1)', 'rgba(0,204,255,.24)', '#00ccff')}>MULTI-CHAIN</span>
              <div style={titleStyle('var(--c)', 19)}>Every Move Recorded</div>
              <div style={descStyle}>Each move is a verifiable transaction. Provably fair, permanently on-chain.</div>
            </div>
          </div>
        </div>

        {/* Row 2 */}
        <div className="features-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>

          {/* Green: Elo */}
          <div
            style={{
              ...cardBase, minHeight: 238,
              background: 'linear-gradient(135deg,#051c14,#020c04)',
              border: '1px solid rgba(0,220,120,.2)',
              boxShadow: '0 2px 0 rgba(0,220,120,.1) inset, 0 -2px 0 rgba(0,0,0,.7) inset, 0 20px 50px rgba(0,180,100,.14)',
            }}
            onMouseEnter={hoverOn} onMouseLeave={hoverOff}
          >
            <BgIcon>
              <svg viewBox="0 0 24 24" fill="none" width="100%" height="100%">
                <polyline points="2 17 8.5 10.5 13.5 15.5 22 7" stroke="rgba(0,220,120,.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="16 7 22 7 22 13" stroke="rgba(0,220,120,.9)" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </BgIcon>
            <div style={{ ...innerStyle, justifyContent: 'flex-end' }}>
              <div style={titleStyle('#00dc78')}>Elo Rankings</div>
              <div style={descStyle}>Win to climb. Lose to fall. Permanent on-chain rating.</div>
            </div>
          </div>

          {/* Amber: Faucet */}
          <div
            style={{
              ...cardBase, minHeight: 238,
              background: 'linear-gradient(135deg,#1c0e00,#0c0600)',
              border: '1px solid rgba(255,180,0,.2)',
              boxShadow: '0 2px 0 rgba(255,180,0,.1) inset, 0 -2px 0 rgba(0,0,0,.7) inset, 0 20px 50px rgba(220,150,0,.14)',
            }}
            onMouseEnter={hoverOn} onMouseLeave={hoverOff}
          >
            <BgIcon>
              <svg viewBox="0 0 24 24" fill="none" width="100%" height="100%">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" stroke="rgba(255,180,0,.9)" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </BgIcon>
            <div style={{ ...innerStyle, justifyContent: 'flex-end' }}>
              <div style={titleStyle('#ffb400')}>Daily Faucet</div>
              <div style={descStyle}>Claim 1,000 CHESS tokens every day — completely free.</div>
            </div>
          </div>

          {/* Dark: Wallets */}
          <div
            style={{
              ...cardBase, minHeight: 238,
              background: 'linear-gradient(135deg,#101020,#080810)',
              border: '1px solid rgba(255,255,255,.08)',
              boxShadow: '0 2px 0 rgba(255,255,255,.06) inset, 0 -2px 0 rgba(0,0,0,.7) inset, 0 16px 44px rgba(0,0,0,.55)',
            }}
            onMouseEnter={hoverOn} onMouseLeave={hoverOff}
          >
            <BgIcon>
              <svg viewBox="0 0 24 24" fill="none" width="100%" height="100%">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </BgIcon>
            <div style={{ ...innerStyle, justifyContent: 'flex-end' }}>
              <div style={titleStyle('var(--t1)')}>Supported</div>
              <div style={descStyle}>MiniPay, MetaMask & any EVM wallet supported.</div>
              <div style={{ marginTop: 12 }}>
                <span style={pillStyle('rgba(0,220,120,.12)', 'rgba(0,220,120,.28)', '#00dc78')}>MiniPay</span>
                <span style={pillStyle('rgba(0,204,255,.12)', 'rgba(0,204,255,.28)', 'var(--c)')}>MetaMask</span>
                <span style={pillStyle('rgba(255,255,255,.07)', 'rgba(255,255,255,.14)', 'var(--t2)')}>EVM</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

