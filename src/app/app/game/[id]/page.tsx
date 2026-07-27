'use client'

import dynamic from 'next/dynamic'

const loadGameClient = () => dynamic(() => import('@/components/game/GameClient'), { ssr: false })

const GameClient = loadGameClient()

export default function GamePage() {
  return <GameClient />
}