'use client'

import dynamic from 'next/dynamic'

// Utility function to dynamically import LobbyContent
const importLobbyContent = () => dynamic(() => import('@/components/lobby/LobbyContent'), { ssr: false })

export default function LobbyPage() {
  const LobbyContent = importLobbyContent()
  return <LobbyContent />
}