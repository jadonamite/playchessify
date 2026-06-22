'use client'

import { motion } from 'framer-motion'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { Environment } from '@react-three/drei'
import { Pawn } from './ChessModels'

interface LoadingStateProps {
  message?: string
  progress?: number // 0 to 100
}

export default function LoadingState({ message = 'SCANNING BLOCKCHAIN', progress }: LoadingStateProps) {
  // If progress is provided, we calculate the X position (-5 to 5)
  // If not, we use a jumping/looping animation
  const isInfinite = progress === undefined

  return (
    <div className="flex flex-col items-center justify-center w-full py-24 gap-12 relative overflow-hidden">
      {/* ── 3D PIECE ANIMATION ── */}
      <div className="w-64 h-64 relative">
        <Canvas camera={{ position: [0, 0, 5], fov: 40 }} gl={{ alpha: true }}>
          <Suspense fallback={null}>
            <ambientLight intensity={1.5} />
            <pointLight position={[10, 10, 10]} intensity={2} color="#00ccff" />
            <Environment files="/textures/environment/city.hdr" />
            
            <group
              position={isInfinite ? [0, 0, 0] : [(progress / 10) - 5, 0, 0]}
            >
              <Pawn 
                color="#00ccff" 
                emissive="#00ccff" 
                emissiveIntensity={0.8}
                floatSpeed={isInfinite ? 3 : 2}
                floatIntensity={isInfinite ? 2 : 1}
              />
            </group>
          </Suspense>
        </Canvas>

        {/* Ambient Glow behind the piece */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,204,255,0.15),transparent_70%)] blur-2xl pointer-events-none" />
      </div>

      {/* ── PROGRESS BAR ── */}
      <div className="w-full max-w-sm flex flex-col items-center gap-4">
        <div className="w-full h-[2px] bg-white/5 relative overflow-hidden rounded-full border border-white/10">
          <motion.div
            className="absolute inset-y-0 left-0 bg-[var(--c)] shadow-[0_0_15px_var(--c)]"
            initial={{ width: 0 }}
            animate={isInfinite ? {
              left: ['-20%', '120%'],
              width: ['20%', '40%', '20%']
            } : {
              width: `${progress}%`
            }}
            transition={isInfinite ? {
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            } : {
              type: "spring",
              stiffness: 50
            }}
          />
        </div>

        {/* ── STATUS TEXT ── */}
        <div className="flex flex-col items-center gap-1">
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-[10px] font-black tracking-[0.4em] text-[var(--c)] uppercase"
            style={{ fontFamily: 'var(--fd)' }}
          >
            {message}
          </motion.span>
          {progress !== undefined && (
            <span className="text-[9px] font-bold text-white/40 font-mono tracking-widest">
              PROCESSED {Math.round(progress)}%
            </span>
          )}
        </div>
      </div>

      {/* Retro Industrial Decor */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-px bg-gradient-to-r from-[var(--c)] to-transparent opacity-30" />
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-px bg-gradient-to-l from-[var(--c)] to-transparent opacity-30" />
    </div>
  )
}
