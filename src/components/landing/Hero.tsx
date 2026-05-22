'use client'
import Image from 'next/image'
import GlowButton from '@/components/ui/GlowButton'
import ThemeToggle from '@/components/ui/ThemeToggle'
import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { useWallet } from '@/components/wallet-provider'
import ChainSelectModal from '@/components/ui/ChainSelectModal'
import { King, Queen, Bishop, Knight, Pawn } from '@/components/ui/ChessModels'
import TypingHeroText from '@/components/ui/TypingHeroText'

const KEYFRAMES = `
@keyframes rspin       { to{transform:translate(-50%,-50%) rotate(360deg)} }
@keyframes pulseDot    { 0%,100%{box-shadow:0 0 8px var(--c),0 0 16px rgba(0,204,255,.4)} 50%{box-shadow:0 0 14px var(--c),0 0 28px rgba(0,204,255,.65)} }
@keyframes fadeUp      { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }

@media (max-width: 768px) {
  .hero-pieces { opacity: 0.55 !important; transform: none !important; }
}

@media (max-width: 1024px) {
  .hero-pieces { pointer-events: none; }
}
`

export function Navbar() {
  const {
    isConnected, address,
    connectWallet, disconnectAll,
    showChainSelect, setShowChainSelect,
    connect, connectSocial
  } = useWallet()

  const connected = isConnected
  const displayAddress = address
  const chainLabel = 'CELO'
  const chainColor = '#35ee66'

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  return (
    <>
      <nav className="hero-navbar w-full flex items-center justify-between" style={{ padding: "18px 56px", position: "relative", zIndex: 20 }}>
        <div>
          <Image src="/chessify.png" alt="Chessify" width={200} height={50} className="w-[140px] md:w-[200px] h-auto object-contain" />
        </div>
        <div className="nav-surface hero-nav-links" style={{ display: "flex", gap: 28, borderRadius: 999, padding: "10px 28px" }}>
          {["How it works", "History", "Faucet"].map((l) => {
            const isAppRoute = l === "Faucet" || l === "History"
            const path = isAppRoute ? `/app/${l.toLowerCase()}` : `#${l.toLowerCase().replace(" ", "-")}`
            
            return (
              <Link
                key={l}
                href={path}
                style={{ fontFamily: "var(--fd)", fontSize: 12, fontWeight: 500, color: "var(--t2)", textDecoration: "none", letterSpacing: ".06em", transition: "color .2s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--c)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--t2)"; }}
              >
                {l}
              </Link>
            )
          })}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          {connected && displayAddress ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Chain badge */}
              <div
                className="flex items-center gap-1.5 py-1 px-2.5 rounded-full"
                style={{ background: `${chainColor}15`, border: `1px solid ${chainColor}30` }}
              >
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: chainColor }} />
                <span className="text-[9px] font-bold tracking-[0.15em]" style={{ color: chainColor, fontFamily: 'var(--fd)' }}>
                  {chainLabel}
                </span>
              </div>
              {/* Address */}
              <span
                className="text-[10px] sm:text-[11px]"
                style={{
                  fontFamily: "var(--fb)", color: "var(--t1)",
                  background: "var(--b1)", padding: "6px 12px", borderRadius: 999,
                  border: '1px solid var(--b2)'
                }}
              >
                {formatAddress(displayAddress)}
              </span>
              {/* Disconnect */}
              <button
                onClick={disconnectAll}
                style={{ background: "transparent", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 18, padding: '0 4px' }}
                title="Disconnect Wallet"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              className="text-[10px] sm:text-[11px] px-3 py-2 sm:px-4"
              style={{
                background: "var(--c)",
                color: "#000",
                border: "none",
                fontWeight: "bold",
                borderRadius: 999,
                cursor: "pointer",
                fontFamily: 'var(--fd)'
              }}
            >
              Connect Wallet
            </button>
          )}
        </div>
      </nav>

      {/* Chain Select Modal */}
      <ChainSelectModal
        isOpen={showChainSelect}
        onClose={() => setShowChainSelect(false)}
        onSelectCelo={connect}
        onSelectSocial={connectSocial}
      />
    </>
  )
}




export default function Hero() {
  const { isConnected, connectWallet } = useWallet()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <section className="hero-section" style={{ background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      <style>{KEYFRAMES}</style>

      {/* Ambient mesh */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 65% 55% at 50% 40%,rgba(0,204,255,.07) 0%,transparent 60%),radial-gradient(ellipse 35% 35% at 18% 80%,rgba(120,60,220,.05) 0%,transparent 60%)', pointerEvents: 'none' }} />
      {/* Grid */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px)', backgroundSize: '52px 52px', pointerEvents: 'none', WebkitMaskImage: 'radial-gradient(ellipse 90% 90% at 50% 50%,black 30%,transparent 80%)', maskImage: 'radial-gradient(ellipse 90% 90% at 50% 50%,black 30%,transparent 80%)' }} />

      <Navbar />

      <div className="hero-content" style={{ position: 'relative', minHeight: 'calc(100vh - 76px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: isMobile ? '20px 16px 60px' : '60px 48px 80px' }}>

        {/* PIECES — z:2, BEHIND text */}
        <div className="hero-pieces" style={{ 
          position: 'absolute', 
          inset: 0, 
          pointerEvents: 'none', 
          zIndex: 2,
          opacity: isMobile ? 0.6 : 1
        }}>
          <Canvas camera={{ position: [0, 0, 15], fov: 45 }} gl={{ alpha: true }}>
            <Suspense fallback={null}>
              <ambientLight intensity={1.5} />
              <pointLight position={[10, 10, 10]} intensity={2.5} color="#00ccff" />
              <pointLight position={[-10, -10, -10]} intensity={1.5} color="#6a0dad" />
              <Environment files="/textures/environment/city.hdr" />

              <King position={[0, isMobile ? 1.5 : 6, isMobile ? -4 : -5]} scale={isMobile ? 3.0 : 5.0} color="#00ccff" emissive="#00ccff" emissiveIntensity={0.6} floatIntensity={1.8} floatSpeed={1.5} />
              <Queen position={[isMobile ? -4.5 : -12, isMobile ? 3.5 : 7, isMobile ? -10 : -12]} rotation={[0.2, 0.4, 0]} scale={isMobile ? 1.6 : 3.2} color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} floatIntensity={2.5} floatSpeed={1.2} />
              <Bishop position={[isMobile ? 4.5 : 12, isMobile ? 3.5 : 7.5, isMobile ? -10 : -14]} rotation={[-0.2, -0.4, 0]} scale={isMobile ? 1.5 : 3.0} color="#111111" emissive="#333333" emissiveIntensity={0.2} floatIntensity={1.6} floatSpeed={1.4} />
              <Knight position={[isMobile ? -4.8 : -14, isMobile ? -4 : -6.5, isMobile ? -9 : -10]} rotation={[0.1, 0.6, 0]} scale={isMobile ? 1.4 : 2.8} color="#111111" emissive="#333333" emissiveIntensity={0.2} floatIntensity={1.4} floatSpeed={1.3} />
              <Pawn position={[isMobile ? 4.8 : 14.5, isMobile ? -4 : -7, isMobile ? -9 : -12]} rotation={[-0.1, -0.6, 0]} scale={isMobile ? 1.3 : 2.6} color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} floatIntensity={1.7} floatSpeed={1.1} />
            </Suspense>
          </Canvas>
          {/* Rings */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: isMobile ? 200 : 300, height: isMobile ? 200 : 300, border: '1px dashed rgba(0,204,255,.09)', borderRadius: '50%', transform: 'translate(-50%,-50%)', animation: 'rspin 28s linear infinite' }} />
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: isMobile ? 320 : 480, height: isMobile ? 320 : 480, border: '1px solid rgba(0,204,255,.04)', borderRadius: '50%', transform: 'translate(-50%,-50%)' }} />
          {/* Float cards */}
          {!isMobile && (
            <>
              <div className="hero-float-cards" style={{ position: 'absolute', right: '2%', top: '44%', padding: '12px 18px', borderRadius: 16, fontFamily: 'var(--fd)', background: 'linear-gradient(145deg,#041a2c,#020f1a)', border: '1px solid rgba(0,204,255,.26)', boxShadow: '0 2px 0 rgba(0,204,255,.12) inset,0 14px 36px rgba(0,180,240,.14)' }}>
                <div style={{ fontSize: 9, letterSpacing: '.12em', color: 'rgba(255,255,255,.35)', marginBottom: 4 }}>CURRENT LEADER</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#00ccff' }}>ELO 2,418</div>
              </div>
              <div className="hero-float-cards" style={{ position: 'absolute', left: '1%', top: '60%', padding: '12px 18px', borderRadius: 16, fontFamily: 'var(--fd)', background: 'linear-gradient(145deg,#14142c,#0c0c1e)', border: '1px solid rgba(255,255,255,.1)', boxShadow: '0 2px 0 rgba(255,255,255,.07) inset,0 14px 36px rgba(0,0,0,.5)' }}>
                <div style={{ fontSize: 9, letterSpacing: '.12em', color: 'rgba(255,255,255,.35)', marginBottom: 4 }}>PRIZE POOL</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--t1)' }}>1,000 CHESS</div>
              </div>
            </>
          )}
        </div>

        {/* TEXT — z:10, IN FRONT of pieces */}
        <div style={{ position: 'relative', zIndex: 10, width: '100%' }}>
          <div className="hero-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--badge-bg)', border: '1px solid var(--b1)', borderRadius: 999, padding: '7px 18px', marginBottom: 24, animation: 'fadeUp .6s cubic-bezier(.16,1,.3,1) both' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c)', animation: 'pulseDot 2s ease-in-out infinite', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--fd)', fontSize: 9, fontWeight: 600, color: 'var(--c)', letterSpacing: '.14em' }}>ON-CHAIN CHESS — MULTI-CHAIN</span>
          </div>

          <TypingHeroText 
            prefix="THE CHECKMATE" 
            subtitle="IS VERIFIED"
            words={["CHAIN", "STAKE", "MOVE"]} 
            className="mb-14"
          />

          <p style={{ fontSize: isMobile ? 14 : 17, color: 'var(--t2)', lineHeight: 1.72, margin: '0 auto 38px', maxWidth: 500, fontWeight: 300, animation: 'fadeUp .6s cubic-bezier(.16,1,.3,1) .2s both', padding: '0 20px' }}>
            Wager CHESS tokens, play on-chain.<br />Every move permanently recorded. Your rating, your winnings — provably yours.
          </p>

          <div className="hero-stats" style={{ display: 'flex', justifyContent: 'center', marginBottom: 46, animation: 'fadeUp .6s cubic-bezier(.16,1,.3,1) .3s both' }}>
            <div style={{ paddingRight: isMobile ? 14 : 28, borderRight: '1px solid var(--b1)' }}>
              <div style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: isMobile ? 14 : 18, color: 'var(--c)' }}>CHESS</div>
              <div style={{ fontFamily: 'var(--fd)', fontSize: 8, color: 'var(--t3)', letterSpacing: '.15em', marginTop: 4 }}>TOKEN</div>
            </div>
            <div style={{ paddingLeft: isMobile ? 14 : 28 }}>
              <div style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: isMobile ? 14 : 18, color: 'var(--c)' }}>Celo</div>
              <div style={{ fontFamily: 'var(--fd)', fontSize: 8, color: 'var(--t3)', letterSpacing: '.15em', marginTop: 4 }}>MAINNET</div>
            </div>
          </div>

          <div style={{ animation: 'fadeUp .6s cubic-bezier(.16,1,.3,1) .4s both' }}>
            {!isConnected ? (
              <GlowButton variant="brand" parallelogram size="lg" onClick={connectWallet} className="btn-brand-para-mobile">START PLAYING</GlowButton>
            ) : (
              <Link href="/app/lobby">
                <GlowButton variant="brand" parallelogram size="lg" className="btn-brand-para-mobile">GO TO LOBBY</GlowButton>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Scroll */}
      {!isMobile && (
        <div style={{ textAlign: 'center', paddingBottom: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative', zIndex: 4 }}>
          <span style={{ fontFamily: 'var(--fd)', fontSize: 9, letterSpacing: '.2em', color: 'var(--scroll-color)' }}>SCROLL</span>
          <div style={{ width: 1, height: 32, background: 'linear-gradient(var(--c),transparent)' }} />
        </div>
      )}
    </section>
  )
}
