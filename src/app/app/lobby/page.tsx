'use client'

import dynamic from 'next/dynamic'

// Utility function to dynamically import LobbyContent
const importLobbyContent = () => dynamic(() => import('@/components/lobby/LobbyContent'), { ssr: false })

const LobbyContent = importLobbyContent()

export default function LobbyPage() {
  return <LobbyContent />
}