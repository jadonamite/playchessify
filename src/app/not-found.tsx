'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, Float, Environment, ContactShadows, PresentationControls } from '@react-three/drei'
import { useRef, Suspense } from 'react'
import * as THREE from 'three'
import Link from 'next/link'
import GlowButton from '@/components/ui/GlowButton'
import { Navbar } from '@/components/landing/Hero'

function KnightModel() {
  const { scene } = useGLTF('/models/chess-knight.glb')
  const meshRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.5
    }
  })

  return (
    <primitive 
      ref={meshRef} 
      object={scene} 
      scale={2.5} 
      position={[0, -2, 0]}
    />
  )
}

/**
 * Scene
 * @returns {*}
 */
function Scene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} color="#00ccff" />
      <pointLight position={[-10, -10, -10]} intensity={1} color="#783cdc" />
      
      <Suspense fallback={null}>
        <PresentationControls
          global

          snap
          rotation={[0, 0.3, 0]}
          polar={[-Math.PI / 3, Math.PI / 3]}
          azimuth={[-Math.PI / 1.4, Math.PI / 1.4]}
        >
          <Float speed={2} rotationIntensity={1.5} floatIntensity={2}>
            <KnightModel />
          </Float>
        </PresentationControls>
        <ContactShadows position={[0, -2.5, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
        <Environment files="/textures/environment/city.hdr" />
      </Suspense>
    </>
  )
}

import { motion } from 'framer-motion'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[var(--bg)] flex flex-col items-center relative overflow-hidden">
      <Navbar />
      
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 10], fov: 35 }}>
          <Scene />
        </Canvas>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center flex-1 text-center px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
           <h1 className="text-[12rem] md:text-[20rem] font-black leading-none tracking-tighter text-white/5 select-none">
             404
           </h1>
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full">
             <h2 className="text-4xl md:text-7xl font-black uppercase tracking-tighter text-[var(--t1)] drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
               Checkmated by <span className="text-[var(--c)]">the Void</span>
             </h2>
             <p className="text-[var(--t2)] mt-6 max-w-md mx-auto text-lg font-medium">
               The move you&apos;re looking for doesn&apos;t exist in our protocol. Retrace your steps back to the lobby.
             </p>
           </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12"
        >
          <Link href="/">
            <GlowButton variant="brand" parallelogram size="lg">RESUME PLAY</GlowButton>
          </Link>
        </motion.div>
      </div>

      {/* Decorative lines */}
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[var(--c)] to-transparent opacity-30" />
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[var(--c)] to-transparent opacity-10" />
    </main>
  )
}
