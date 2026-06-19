'use client'
import GlowButton from '@/components/ui/GlowButton'
import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { useWallet } from '@/components/wallet-provider'
import { King, Queen, Bishop, Knight, Pawn } from '@/components/ui/ChessModels'
import TypingHeroText from '@/components/ui/TypingHeroText'
import { useRouter } from 'next/navigation'
import NavbarComponent from '@/components/ui/Navbar'

// Re-export so all existing `import { Navbar } from '@/components/landing/Hero'` keep working
export { default as Navbar } from '@/components/ui/Navbar'

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

/**
 * Hero
 * @returns {*}
 */
export default function Hero() {
  const { isConnected, connectWallet } = useWallet()
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (isConnected) {
      router.replace('/app/lobby')
    }
  }, [isConnected, router])

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <section className="hero-section" style={{ background: 'var(--bg)', position: 'relative', overflow: 'clip' }}>
      <style>{KEYFRAMES}</style>

      {/* Ambient mesh */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 65% 55% at 50% 40%,rgba(0,204,255,.07) 0%,transparent 60%),radial-gradient(ellipse 35% 35% at 18% 80%,rgba(120,60,220,.05) 0%,transparent 60%)', pointerEvents: 'none' }} />
      {/* Grid */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px)', backgroundSize: '52px 52px', pointerEvents: 'none', WebkitMaskImage: 'radial-gradient(ellipse 90% 90% at 50% 50%,black 30%,transparent 80%)', maskImage: 'radial-gradient(ellipse 90% 90% at 50% 50%,black 30%,transparent 80%)' }} />

      <NavbarComponent />

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
