'use client'

import dynamic from 'next/dynamic'

// Utility function to dynamically import components
const dynamicImport = (componentPath: string) => dynamic(() => import(componentPath), { ssr: false })

// Shell to prevent block-chain SDKs from leaking into the server build
const LobbyContent = dynamicImport('@/components/lobby/LobbyContent')

export default function LobbyPage() {
  return <LobbyContent />
}