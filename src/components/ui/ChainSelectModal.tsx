'use client'

import { Suspense, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Canvas } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { useGLTF, Float } from '@react-three/drei'
import * as THREE from 'three'
import GlowButton from './GlowButton'

/* ── PRELOADS ── */
useGLTF.preload('/models/King.glb')
useGLTF.preload('/models/QueenChess.glb')

/* ── 3D Pieces ── */
function ChainPiece({ modelPath, color, emissive, scale = 1.5 }: { modelPath: string; color: string; emissive: string; scale?: number }) {
  const { scene } = useGLTF(modelPath)

  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 0.5,
    roughness: 0.2,
    metalness: 0.8,
  }), [color, emissive])

  const clonedScene = useMemo(() => {
    const clone = scene.clone()
    clone.traverse((child: any) => {
      if (child.isMesh) child.material = material
    })
    return clone
  }, [scene, material])

  return (
    <Float speed={2} rotationIntensity={0.8} floatIntensity={1.2}>
      <primitive object={clonedScene} scale={scale} />
    </Float>
  )
}

/* ── Chain Card ── */
function ChainCard({
  name,
  ecosystem,
  description,
  accentColor,
  accentGlow,
  iconUrl,
  onClick,
  delay = 0,
  children,
}: {
  name: string
  ecosystem: string
  description: string
  accentColor: string
  accentGlow: string
  iconUrl: string
  onClick: () => void
  delay?: number
  children: React.ReactNode
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 180, damping: 20 }}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative w-full rounded-[28px] border border-white/10 bg-slate-900/60 backdrop-blur-xl overflow-hidden text-left cursor-pointer group transition-all"
      style={{
        boxShadow: `0 0 0 1px rgba(255,255,255,0.05), 0 20px 60px rgba(0,0,0,0.4)`,
      }}
    >
      {/* Hover glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 80%, ${accentGlow}, transparent 70%)`,
        }}
      />

      {/* 3D Scene */}
      <div className="w-full h-40 md:h-48 relative">
        <Canvas camera={{ position: [0, 0, 4.5], fov: 40 }} gl={{ alpha: true }}>
          <Suspense fallback={null}>
            <ambientLight intensity={1.5} />
            <pointLight position={[5, 5, 5]} intensity={2} color={accentColor} />
            <Environment files="/textures/environment/city.hdr" />
            {children}
          </Suspense>
        </Canvas>

        {/* Gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-900/60 to-transparent" />
      </div>

      {/* Body */}
      <div className="px-6 pb-6 pt-1 relative z-10">
        {/* Ecosystem Badge */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 flex items-center justify-center relative bg-white/5 rounded-lg border border-white/10 p-1">
            <img src={iconUrl} alt="chain" className="w-full h-full object-contain" />
          </div>
          <span
            className="text-[9px] font-black tracking-[0.3em] uppercase"
            style={{ color: accentColor, fontFamily: 'var(--fd)' }}
          >
            {ecosystem}
          </span>
        </div>

        {/* Chain Name */}
        <h3
          className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white mb-2"
          style={{ fontFamily: 'var(--fd)' }}
        >
          {name}
        </h3>

        {/* Description */}
        <p className="text-[11px] text-white/40 leading-relaxed mb-4">
          {description}
        </p>

        {/* Connect Indicator */}
        <div
          className="flex items-center gap-2 py-2 px-4 rounded-full border w-fit transition-all group-hover:border-opacity-60"
          style={{
            borderColor: `${accentColor}30`,
            background: `${accentColor}08`,
          }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full group-hover:animate-pulse"
            style={{ background: accentColor }}
          />
          <span
            className="text-[10px] font-bold tracking-[0.2em] uppercase"
            style={{ color: accentColor, fontFamily: 'var(--fd)' }}
          >
            CONNECT →
          </span>
        </div>
      </div>
    </motion.button>
  )
}

/* ═════════════════════════════════════════════════
   CHAIN SELECT MODAL
   ═════════════════════════════════════════════════ */

interface ChainSelectModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectCelo: () => void
  onSelectSocial: () => void
}

const SOCIAL_PROVIDERS = [
  { name: 'Google',  icon: 'https://www.svgrepo.com/show/303108/google-icon-logo.svg' },
  { name: 'GitHub',  icon: 'https://www.svgrepo.com/show/512317/github-142.svg' },
  { name: 'Twitter', icon: 'https://www.svgrepo.com/show/506463/twitter-x.svg' },
  { name: 'Apple',   icon: 'https://www.svgrepo.com/show/452188/apple.svg' },
]

export default function ChainSelectModal({
  isOpen,
  onClose,
  onSelectCelo,
  onSelectSocial,
}: ChainSelectModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 box-border"
          style={{ background: 'rgba(5, 5, 15, 0.92)', backdropFilter: 'blur(20px)' }}
        >
          {/* Grid Background */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px)',
            backgroundSize: '52px 52px', pointerEvents: 'none',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%,black 20%,transparent 70%)',
            maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%,black 20%,transparent 70%)',
            opacity: 0.3,
          }} />

          {/* Content */}
          <div className="relative z-10 w-full max-w-3xl flex flex-col items-center gap-8">

            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-center"
            >
              <h2
                className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter text-white mb-3"
                style={{ fontFamily: 'var(--fd)', textShadow: 'var(--hero-text-shadow)' }}
              >
                Choose Your{' '}
                <span style={{ color: 'var(--c)', textShadow: 'var(--king-text-shadow)' }}>Network</span>
              </h2>
              <p className="text-[11px] font-bold tracking-[0.3em] text-white/30 uppercase">
                Select a blockchain to connect your wallet
              </p>
            </motion.div>

            {/* Chain Cards */}
            <div className="grid grid-cols-1 gap-5 w-full max-w-sm mx-auto">

              {/* Celo Card */}
              <ChainCard
                name="Celo"
                ecosystem="EVM • Ethereum Ecosystem"
                description="Connect with MiniPay, MetaMask, WalletConnect, or any EVM-compatible wallet."
                accentColor="#35ee66"
                accentGlow="rgba(53, 238, 102, 0.08)"
                iconUrl="/celo-celo-logo.svg"
                onClick={onSelectCelo}
                delay={0.2}
              >
                <ChainPiece modelPath="/models/King.glb" color="#35ee66" emissive="#35ee66" scale={1.8} />
              </ChainCard>

            </div>

            {/* Social login divider */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="w-full flex items-center gap-4"
            >
              <div className="flex-1 h-px bg-white/8" />
              <span className="text-[10px] font-bold tracking-[0.25em] text-white/25 uppercase whitespace-nowrap">
                or sign in with
              </span>
              <div className="flex-1 h-px bg-white/8" />
            </motion.div>

            {/* Social login button */}
            <motion.button
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, type: 'spring', stiffness: 200, damping: 22 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={onSelectSocial}
              className="w-full flex items-center justify-center gap-4 py-3.5 px-6 rounded-2xl border border-white/10 bg-white/4 hover:bg-white/8 hover:border-white/20 transition-all group"
            >
              {/* Provider icons */}
              <div className="flex items-center gap-2">
                {SOCIAL_PROVIDERS.map((provider) => (
                  <div
                    key={provider.name}
                    className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center overflow-hidden"
                    title={provider.name}
                  >
                    <img
                      src={provider.icon}
                      alt={provider.name}
                      className="w-3 h-3 object-contain opacity-60 group-hover:opacity-90 transition-opacity"
                      style={{ filter: 'brightness(0) invert(1)' }}
                    />
                  </div>
                ))}
              </div>
              <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/40 group-hover:text-white/70 transition-colors">
                Continue with Social
              </span>
            </motion.button>

            {/* Dismiss */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
            >
              <GlowButton variant="ghost" size="sm" onClick={onClose}>
                CANCEL
              </GlowButton>
            </motion.div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
