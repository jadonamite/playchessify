'use client'

import dynamic from 'next/dynamic'

// Utility function to dynamically import components
const importComponent = (path: string) => dynamic(() => import(path), { ssr: false })

// Shell to prevent block-chain SDKs from leaking into the server build
const LobbyContent = importComponent('@/components/lobby/LobbyContent')

export default function LobbyPage() {
  return <LobbyContent />
}