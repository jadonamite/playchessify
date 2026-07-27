'use client'

import { Canvas } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { King, Pawn, Knight } from './ChessModels'
import { Suspense, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

function WarningScene() {
  return (
    <>
      <ambientLight intensity={1} />
      <pointLight position={[10, 10, 10]} intensity={2} color="#ffb400" />
      <Environment preset="sunset" />
      <Pawn color="#ffb400" emissive="#ffb400" emissiveIntensity={0.4} position={[0, -0.6, 0]} floatSpeed={1} floatIntensity={0.5} rotationIntensity={0.2} />
    </>
  )
}

function CheckScene() {
  return (
    <>
      <ambientLight intensity={1.5} />
      <pointLight position={[10, 10, 10]} intensity={3} color="#ff4466" />
      <Environment preset="night" />
      <Knight color="#ff4466" emissive="#ff4466" emissiveIntensity={0.6} position={[0, -0.5, 0]} floatSpeed={1.5} floatIntensity={1} rotationIntensity={0.8} />
    </>
  )
}

function CheckmateScene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={3} color="#6a0dad" />
      <pointLight position={[-10, -5, 5]} intensity={2} color="#ff4466" />
      <Environment preset="night" />
      <King color="#111111" emissive="#ff4466" emissiveIntensity={0.2} position={[0, -0.5, 0]} floatSpeed={0.2} floatIntensity={0.2} rotationIntensity={0} />
    </>
  )
}

function StalemateScene() {
  return (
    <>
      <ambientLight intensity={1.5} />
      <pointLight position={[10, 10, 10]} intensity={2} color="#00ccff" />
      <Environment files="/textures/environment/city.hdr" />
      <King color="#00ccff" emissive="#00ccff" emissiveIntensity={0.4} position={[0, -0.5, 0]} floatSpeed={0.8} floatIntensity={0.4} rotationIntensity={0.15} />
    </>
  )
}

export type GameStatusType = 'invalid_move' | 'check' | 'checkmate' | 'draw' | null

interface GameStatusModalProps {
  type: GameStatusType
  message?: string
  onClose: () => void
}

const STATUS_CONFIG = {
  invalid_move: {
    badge: '⚠ INVALID',
    badgeColor: '#ffb400',
    title: 'ILLEGAL',
    titleAccent: 'MOVE',
    accentColor: '#ffb400',
    description: 'That maneuver violates protocol directives. Try a different tactical approach.',
    buttonText: 'ACKNOWLEDGE',
    buttonVariant: 'ghost' as const,
    Scene: WarningScene,
  },
  check: {
    badge: '⚔ THREAT DETECTED',
    badgeColor: '#ff4466',
    title: 'KING IN',
    titleAccent: 'CHECK',
    accentColor: '#ff4466',
    description: 'Your King is under direct assault. You must parry or evade!',
    buttonText: 'DEFEND',
    buttonVariant: 'brand' as const,
    Scene: CheckScene,
  },
  checkmate: {
    badge: '☠ CRITICAL FAILURE',
    badgeColor: '#6a0dad',
    title: 'CHECK',
    titleAccent: 'MATE',
    accentColor: '#ff4466',
    description: 'The King has fallen. End of line.',
    buttonText: 'ACCEPT DEFEAT',
    buttonVariant: 'brand' as const,
    Scene: CheckmateScene,
  },
  draw: {
    badge: '🤝 STALEMATE',
    badgeColor: '#00ccff',
    title: 'MATCH',
    titleAccent: 'DRAWN',
    accentColor: '#00ccff',
    description: 'Tactical deadlock achieved. Neither commander can proceed.',
    buttonText: 'FINISH',
    buttonVariant: 'ghost' as const,
    Scene: StalemateScene,
  }
}

export default function GameStatusModal({ type, message, onClose }: GameStatusModalProps) {
  const [mounted, setMounted] = useState(false)
  
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration mount flag
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (type === 'invalid_move' || type === 'check') {
      const timer = setTimeout(() => {
        onClose()
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [type, onClose])

  if (!mounted) return null

  const config = type ? STATUS_CONFIG[type] : null

  return (
    <AnimatePresence>
      {type && config && (
        <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center pointer-events-none px-4">
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="w-full max-w-md pointer-events-auto"
          >
             <div className="rounded-2xl border border-white/10 bg-slate-950/90 shadow-[0_0_40px_rgba(0,0,0,0.8)] backdrop-blur-xl overflow-hidden flex flex-row items-center p-3 gap-4">
                
                {/* 3D Icon Area */}
                <div className="w-14 h-14 relative flex-shrink-0 rounded-xl overflow-hidden bg-white/5 border border-white/5">
                  <Canvas camera={{ position: [0, 0, 7], fov: 35 }} gl={{ alpha: true }}>
                    <Suspense fallback={null}>
                      <config.Scene />
                    </Suspense>
                  </Canvas>
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at 50% 50%, ${config.accentColor}15, transparent 70%)`
                    }}
                  />
                </div>

                {/* Text Content */}
                <div className="flex flex-col flex-grow text-left">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: config.badgeColor }} />
                    <span className="text-[10px] tracking-wider font-bold uppercase" style={{ color: config.badgeColor }}>
                      {config.badge}
                    </span>
                  </div>
                  <h3 className="text-[13px] font-black uppercase tracking-tight text-white leading-none mb-1">
                    {config.title} <span style={{ color: config.accentColor }}>{config.titleAccent}</span>
                  </h3>
                  <p className="text-[11px] text-gray-400 font-medium leading-tight">
                    {message || config.description}
                  </p>
                </div>

                {/* Close Button */}
                <button 
                  onClick={onClose} 
                  className="p-3 text-gray-500 hover:text-white transition-colors"
                  aria-label="Dismiss"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
             </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
