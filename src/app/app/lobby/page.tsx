'use client'
import dynamic from 'next/dynamic'

const loadLobbyContent = () => 
  dynamic(() => import('@/components/lobby/LobbyContent'), { ssr: false })

export default function LobbyPage() {
  const LobbyContent = loadLobbyContent()
  return <LobbyContent />
}