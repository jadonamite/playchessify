'use client'

import { Suspense, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Canvas } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { King, Queen, Pawn } from './ChessModels'
import GlowButton from './GlowButton'
import Confetti from './Confetti'

/* ── KEYFRAMES ── */
const KEYFRAMES = `
@keyframes coin-glow {
  0%, 100% { filter: drop-shadow(0 0 15px rgba(0,204,255,0.6)); }
  50%      { filter: drop-shadow(0 0 35px rgba(0,204,255,1)); },
}
`

/* ── 3D Scene: Success ── */
function SuccessScene() {
  return (
    <>
      <ambientLight intensity={2} />
      <pointLight position={[10, 10, 10]} intensity={3} color="#00ccff" />
      <pointLight position={[-10, -5, 5]} intensity={2} color="#35ee66" />
      <Environment files="/textures/environment/city.hdr" />
      <Queen color="#35ee66" emissive="#35ee66" emissiveIntensity={0.6} position={[0, -0.5, 0]} floatSpeed={2} floatIntensity={1.5} rotationIntensity={0.8} />
    </>
  )
}

/* ── 3D Scene: Error ── */
function ErrorScene() {
  return (
    <>
      <ambientLight intensity={1} />
      <pointLight position={[10, 10, 10]} intensity={2} color="#ff4466" />
      <pointLight position={[-10, -5, 5]} intensity={1.5} color="#6a0dad" />
      <Environment preset="night" />
      <Pawn color="#ff4466" emissive="#ff4466" emissiveIntensity={0.6} position={[0, -0.6, 0]} floatSpeed={1} floatIntensity={0.5} rotationIntensity={0.2} />
    </>
  )
}

/* ── 3D Scene: Cooldown ── */
function CooldownScene() {
  return (
    <>
      <ambientLight intensity={1.2} />
      <pointLight position={[10, 10, 10]} intensity={2} color="#ffb400" />
      <Environment preset="sunset" />
      <King color="#ffb400" emissive="#ffb400" emissiveIntensity={0.4} position={[0, -0.5, 0]} floatSpeed={0.8} floatIntensity={0.4} rotationIntensity={0.15} />
    </>
  )
}

/* ── Types ── */
export type FaucetResultType = 'success' | 'error' | 'cooldown' | 'timeout' | null

interface FaucetResultModalProps {
  type: FaucetResultType
  onClose: () => void
  txHash?: string
  amount?: string
  errorMessage?: string
  cooldownRemaining?: string
  chain?: 'celo'
}

/* ── RESULT CONFIGS ── */
const RESULT_CONFIG = {
  success: {
    badge: '✓ CLAIMED',
    badgeColor: '#35ee66',
    title: 'TOKENS',
    titleAccent: 'RECEIVED',
    accentColor: '#35ee66',
    description: 'Your CHESS tokens have been successfully deposited into your wallet.',
    buttonText: 'CONTINUE',
    buttonVariant: 'brand' as const,
    Scene: SuccessScene,
    showConfetti: true,
  },
  error: {
    badge: '✕ FAILED',
    badgeColor: '#ff4466',
    title: 'CLAIM',
    titleAccent: 'FAILED',
    accentColor: '#ff4466',
    description: 'The transaction was rejected by the network. Please check your wallet and try again.',
    buttonText: 'DISMISS',
    buttonVariant: 'ghost' as const,
    Scene: ErrorScene,
    showConfetti: false,
  },
  timeout: {
    badge: '⏱ TIMEOUT',
    badgeColor: '#ffb400',
    title: 'REQUEST',
    titleAccent: 'TIMED OUT',
    accentColor: '#ffb400',
    description: 'The network took too long to respond. Your tokens may still arrive — check your balance shortly.',
    buttonText: 'OK, GOT IT',
    buttonVariant: 'ghost' as const,
    Scene: ErrorScene,
    showConfetti: false,
  },
  cooldown: {
    badge: '⏳ COOLDOWN',
    badgeColor: '#ffb400',
    title: 'FAUCET',
    titleAccent: 'LOCKED',
    accentColor: '#ffb400',
    description: 'You\'ve already claimed recently. The faucet resets on a daily cycle.',
    buttonText: 'UNDERSTOOD',
    buttonVariant: 'ghost' as const,
    Scene: CooldownScene,
    showConfetti: false,
  },
}

export default function FaucetResultModal({
  type,
  onClose,
  txHash,
  amount,
  errorMessage,
  cooldownRemaining,
  chain = 'celo',
}: FaucetResultModalProps) {
  const [mounted, setMounted] = useState(false)

  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration mount flag
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  const config = type ? RESULT_CONFIG[type] : null

  return (
    <AnimatePresence>
      {type && config && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="m-sheet-wrap fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 box-border"
          style={{ background: 'rgba(5, 5, 15, 0.9)', backdropFilter: 'blur(16px)' }}
        >
          <style>{KEYFRAMES}</style>

          {/* Grid Background */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px)',
            backgroundSize: '52px 52px', pointerEvents: 'none',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%,black 20%,transparent 70%)',
            maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%,black 20%,transparent 70%)',
            opacity: 0.3,
          }} />

          {/* Confetti (success only) */}
          {config.showConfetti && <Confetti className="z-0" />}

          {/* Content Card */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 200, damping: 22 }}
            className="m-sheet relative z-10 w-full max-w-lg"
          >
            <div className="rounded-[32px] md:rounded-[40px] border border-white/10 bg-slate-950/70 shadow-[0_0_80px_rgba(0,204,255,0.1)] backdrop-blur-2xl overflow-hidden">

              {/* 3D Scene Header */}
              <div className="w-full h-48 md:h-56 relative">
                <Canvas camera={{ position: [0, 0, 5], fov: 40 }} gl={{ alpha: true }}>
                  <Suspense fallback={null}>
                    <config.Scene />
                  </Suspense>
                </Canvas>

                {/* Gradient Fade */}
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-slate-950/70 to-transparent" />

                {/* Glow Ring */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `radial-gradient(circle at 50% 60%, ${config.accentColor}15, transparent 60%)`,
                    animation: type === 'success' ? 'coin-glow 3s ease-in-out infinite' : undefined,
                  }}
                />
              </div>

              {/* Body */}
              <div className="px-8 md:px-12 pb-10 pt-2 flex flex-col items-center text-center gap-5">

                {/* Badge */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
                  className="flex items-center gap-2 py-1.5 px-4 rounded-full border shadow-inner"
                  style={{
                    borderColor: `${config.badgeColor}40`,
                    background: `${config.badgeColor}10`,
                  }}
                >
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: config.badgeColor }} />
                  <span
                    className="text-[10px] md:text-xs tracking-[0.25em] font-bold uppercase"
                    style={{ fontFamily: 'var(--fd)', color: config.badgeColor }}
                  >
                    {config.badge}
                  </span>
                </motion.div>

                {/* Title */}
                <h2
                  className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight text-white"
                  style={{ fontFamily: 'var(--fd)', textShadow: 'var(--hero-text-shadow)' }}
                >
                  {config.title}<br />
                  <span style={{ color: config.accentColor, textShadow: `0 0 40px ${config.accentColor}60` }}>
                    {config.titleAccent}
                  </span>
                </h2>

                {/* Amount (success) */}
                {type === 'success' && amount && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-baseline gap-2"
                  >
                    <span className="text-4xl md:text-5xl font-black text-white" style={{ fontFamily: 'var(--fd)' }}>
                      +{amount}
                    </span>
                    <span className="text-sm font-bold tracking-widest uppercase" style={{ color: config.accentColor }}>
                      CHESS
                    </span>
                  </motion.div>
                )}

                {/* Cooldown Timer */}
                {type === 'cooldown' && cooldownRemaining && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center gap-3 py-3 px-6 rounded-2xl border border-white/10 bg-black/30"
                  >
                    <span className="text-[10px] font-bold tracking-[0.2em] text-white/50 uppercase">Resets in</span>
                    <span className="text-2xl font-black text-[#ffb400] font-mono tracking-wider">{cooldownRemaining}</span>
                  </motion.div>
                )}

                {/* Description */}
                <p className="text-xs sm:text-sm text-gray-400 font-medium tracking-wide max-w-md leading-relaxed">
                  {errorMessage || config.description}
                </p>

                {/* Tx Hash (success) */}
                {type === 'success' && txHash && (
                  <motion.a
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    href={
                      chain === 'celo'
                        ? `https://celoscan.io/tx/${txHash}`
                        : `https://explorer.hiro.so/txid/${txHash}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold tracking-[0.15em] text-[var(--c)] hover:text-white transition-colors underline underline-offset-4 decoration-white/20"
                    style={{ fontFamily: 'var(--fd)' }}
                  >
                    VIEW ON {chain === 'celo' ? 'CELOSCAN' : 'HIRO EXPLORER'} →
                  </motion.a>
                )}

                {/* Separator */}
                <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-1" />

                {/* Action Button */}
                <GlowButton
                  parallelogram
                  variant={config.buttonVariant}
                  size="lg"
                  onClick={onClose}
                  className="min-w-full sm:min-w-[220px]"
                >
                  {config.buttonText}
                </GlowButton>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
