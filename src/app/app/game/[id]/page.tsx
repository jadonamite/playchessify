'use client'

import dynamic from 'next/dynamic'
// NOTE: revisit this logic after API migration

const GameClient = dynamic(
  () => import('@/components/game/GameClient'),
  { ssr: false }
)

export default function GamePage() {
  return <GameClient />
}
