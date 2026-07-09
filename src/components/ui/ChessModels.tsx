'use client'

import { useMemo, useRef } from 'react'
import { useGLTF, Float } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/* ── PRELOADS ──
   Only the King is shown above the fold (landing hero). The other pieces
   load on demand where they are actually rendered (e.g. the game board),
   so we don't saturate the hero's bandwidth fetching ~6MB of unused GLBs. */
useGLTF.preload('/models/King.glb')

interface PieceProps {
  color?: string
  emissive?: string
  emissiveIntensity?: number
  scale?: number
  position?: [number, number, number]
  rotation?: [number, number, number]
  floatSpeed?: number
  floatIntensity?: number
  rotationIntensity?: number
  /* Optional PBR overrides so a caller can dial in a more physical, reflective
     material (e.g. the hero king) without affecting the default matte pieces. */
  roughness?: number
  metalness?: number
}

function BasePiece({ modelPath, color = '#00ccff', emissive, emissiveIntensity, scale = 1, position = [0, 0, 0], rotation = [0, 0, 0], floatSpeed = 1, floatIntensity = 0.5, rotationIntensity = 0.3, roughness, metalness }: PieceProps & { modelPath: string }) {
  const { scene } = useGLTF(modelPath)

  const material = useMemo(() => {
    // Default emissive is a soft self-tint so the piece reads in low light;
    // callers can override with a stronger glow (e.g. modal accents).
    const resolvedEmissive = emissive ?? (color === '#00ccff' ? color : '#000')
    const resolvedEmissiveIntensity = emissiveIntensity ?? 0.15
    return new THREE.MeshStandardMaterial({
      color: color === '#ffffff' ? '#ffffff' : (color === '#111111' ? '#080808' : color),
      emissive: resolvedEmissive,
      emissiveIntensity: resolvedEmissiveIntensity,
      roughness: roughness ?? 0.88,
      metalness: metalness ?? 0.1,
    })
  }, [color, emissive, emissiveIntensity, roughness, metalness])

  const meshRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.getElapsedTime()
    // Add bit of variance based on position to avoid perfectly synced rotation
    const offset = position[0] * 0.1 + position[1] * 0.2
    meshRef.current.rotation.y = (t + offset) * 0.3
    meshRef.current.rotation.z = Math.sin((t + offset) * 0.5) * 0.05
  })

  const clonedScene = useMemo(() => {
    const clone = scene.clone()
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (mesh.isMesh) {
        mesh.material = material
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
    return clone
  }, [scene, material])

  return (
    <Float 
      speed={floatSpeed * 1.5} 
      rotationIntensity={rotationIntensity * 2.5} 
      floatIntensity={floatIntensity * 2} 
      position={position}
    >
      <primitive ref={meshRef} object={clonedScene} scale={scale} rotation={rotation} />
    </Float>
  )
}

export function PieceIcon({
  type,
  color = 'white',
  set = 'maestro',
  className = 'w-12 h-12',
}: {
  type: 'king' | 'queen' | 'rook' | 'pawn' | 'bishop' | 'knight'
  color?: 'white' | 'black'
  set?: string
  className?: string
}) {
  const prefix = color === 'black' ? 'b' : 'w'
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/pieces/${set}/${prefix}${PIECE_LETTER[type]}.svg`}
      alt={type}
      draggable={false}
      className={`${className} object-contain select-none pointer-events-none`}
    />
  )
}


/* ── 2D PIECE ICON FOR LISTS / CARDS / PICKERS ──
   Replaces the old per-element 3D <Canvas> (PieceView), which minted a WebGL
   context per icon and blew the browser's context budget on list-heavy screens.
   A crisp 2D sprite is sharper at icon sizes and costs zero GL contexts. The
   decorative 3D now lives only in page backgrounds (see PageBackground). */
const PIECE_LETTER: Record<'king' | 'queen' | 'rook' | 'pawn' | 'bishop' | 'knight', string> = {
  king: 'K', queen: 'Q', rook: 'R', pawn: 'P', bishop: 'B', knight: 'N',
}

export const King = (props: PieceProps) => <BasePiece modelPath="/models/King.glb" scale={1.87} {...props} />
export const Queen = (props: PieceProps) => <BasePiece modelPath="/models/QueenChess.glb" scale={1.62} {...props} />
export const Rook = (props: PieceProps) => <BasePiece modelPath="/models/Rook.glb" scale={1.37} {...props} />
export const Pawn = (props: PieceProps) => <BasePiece modelPath="/models/pawn.glb" scale={1.25} {...props} />
export const Bishop = (props: PieceProps) => <BasePiece modelPath="/models/Bishop.glb" scale={1.45} {...props} />
export const Knight = (props: PieceProps) => <BasePiece modelPath="/models/WhiteKnight.glb" scale={1.4} {...props} />