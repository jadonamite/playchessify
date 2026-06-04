'use client'

import { useEffect, useState, Suspense, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Canvas } from '@react-three/fiber'
import { useGLTF, Float, Environment } from '@react-three/drei'
import * as THREE from 'three'
import GlowButton from '@/components/ui/GlowButton'

// PRELOAD
useGLTF.preload('/models/King.glb')
useGLTF.preload('/models/QueenChess.glb')
useGLTF.preload('/models/Rook.glb')

function FloatingPieces() {
  const king = useGLTF('/models/King.glb')
  const queen = useGLTF('/models/QueenChess.glb')
  const rook = useGLTF('/models/Rook.glb')

  const cyanMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#00ccff', emissive: '#00ccff', emissiveIntensity: 0.4, roughness: 0.2, metalness: 0.8
  }), [])

  const slateMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#0f172a', roughness: 0.4, metalness: 0.6
  }), [])

  const applyMaterial = (scene: THREE.Group, material: THREE.Material) => {
    const clone = scene.clone()
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (mesh.isMesh) mesh.material = material
    })
    return clone
  }

  const coloredQueen = useMemo(() => applyMaterial(queen.scene, cyanMaterial), [queen.scene, cyanMaterial])
  const coloredKing = useMemo(() => applyMaterial(king.scene, cyanMaterial), [king.scene, cyanMaterial])
  const coloredRook = useMemo(() => applyMaterial(rook.scene, slateMaterial), [rook.scene, slateMaterial])

  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[10, 10, 5]} intensity={2} color="#00ccff" />
      <directionalLight position={[-10, -10, -5]} intensity={1} color="#6a0dad" />
      <Environment files="/textures/environment/city.hdr" />

      {/* 1.25x Scale & Brought closer to center */}
      <Float speed={2} rotationIntensity={1.5} floatIntensity={2} position={[-1.5, 0, -1]}>
        <primitive object={coloredQueen} scale={1.5} rotation={[0.4, 0.2, 0.1]} />
      </Float>

      <Float speed={1.5} rotationIntensity={2} floatIntensity={3} position={[0, -0.5, 0]}>
        <primitive object={coloredKing} scale={1.87} rotation={[-0.1, 0.5, 0.2]} />
      </Float>

      <Float speed={2.5} rotationIntensity={1} floatIntensity={1.5} position={[1.8, 0.2, -0.5]}>
        <primitive object={coloredRook} scale={1.37} rotation={[0.2, -0.4, -0.1]} />
      </Float>
    </>
  )
}

interface ComingSoonOverlayProps {
  isOpen: boolean
  onClose: () => void
}

export default function ComingSoonOverlay({ isOpen, onClose }: ComingSoonOverlayProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration mount flag
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6  box-border"
          style={{ background: 'rgba(5, 5, 15, 0.85)', backdropFilter: 'blur(12px)' }}
        >
          {/* Cyber-industrial Grid Background */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px)', backgroundSize: '52px 52px', pointerEvents: 'none', WebkitMaskImage: 'radial-gradient(ellipse 90% 90% at 50% 50%,black 30%,transparent 80%)', maskImage: 'radial-gradient(ellipse 90% 90% at 50% 50%,black 30%,transparent 80%)', opacity: 0.5 }} />

          {/* 3D Canvas Background */}
          <div className="absolute inset-0 pointer-events-none opacity-60">
            <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
              <Suspense fallback={null}>
                <FloatingPieces />
              </Suspense>
            </Canvas>
          </div>

          {/* Text & Interactivity Layer */}
          <div className="relative z-10 flex flex-col items-center justify-center text-center w-full max-w-3xl box-border">
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
              className="flex flex-col items-center gap-5 md:gap-6 p-8 md:p-16 rounded-[32px] md:rounded-[40px] border border-white/10 bg-slate-950/60 shadow-[0_0_80px_rgba(0,204,255,0.15)] backdrop-blur-2xl w-full mx-auto box-border"
            >

              <div className="flex items-center gap-2 bg-black/40 py-1.5 px-4 rounded-full border border-white/10 shadow-inner">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--c)] animate-pulse" />
                <span className="text-[10px] md:text-xs tracking-[0.25em] font-bold text-[var(--c)] uppercase" style={{ fontFamily: 'var(--fd)' }}>
                  System Update
                </span>
              </div>

              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter leading-tight text-white my-2" style={{ fontFamily: 'var(--fd)', textShadow: 'var(--hero-text-shadow)' }}>
                WE WILL BE BACK<br />
                <span className="text-[var(--c)]" style={{ textShadow: 'var(--king-text-shadow)' }}>SOON</span>
              </h2>

              <p className="text-xs sm:text-sm md:text-base text-gray-400 font-medium tracking-wide max-w-lg leading-relaxed px-2">
                Our team is currently working to <span className="text-white">Checkmate this gambit</span>.
              </p>

              <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-2 md:my-4" />

              <GlowButton parallelogram variant="brand" size="lg" onClick={onClose} className="min-w-full sm:min-w-[200px] shrink-0">
                RETURN TO LOBBY
              </GlowButton>
            </motion.div>
          </div>

        </motion.div>
      )}
    </AnimatePresence>
  )
}