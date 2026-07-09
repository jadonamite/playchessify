'use client'

import dynamic from 'next/dynamic'

// Shell to prevent block-chain SDKs from leaking into the server build
const loadLobbyContent = () => dynamic(() => import('@/components/lobby/LobbyContent'), { ssr: false })

export default function LobbyPage() {
  const LobbyContent = loadLobbyContent()
  return <LobbyContent />
}