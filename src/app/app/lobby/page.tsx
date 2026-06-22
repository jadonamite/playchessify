'use client'
import dynamic from 'next/dynamic'

const loadLobbyContent = () => {
  return dynamic(() => import('@/components/lobby/LobbyContent'), { ssr: false })
}

const LobbyContent = loadLobbyContent()

export default function LobbyPage() {
  return <LobbyContent />
}