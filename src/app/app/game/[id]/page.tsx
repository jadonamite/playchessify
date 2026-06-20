'use client'
import dynamic from 'next/dynamic'

const loadGameClient = () => 
  dynamic(() => import('@/components/game/GameClient'), { ssr: false })

export default function GamePage() {
  const GameClient = loadGameClient()
  return <GameClient />
}