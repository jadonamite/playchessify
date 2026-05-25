'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAccount, useDisconnect } from 'wagmi'

interface WalletContextType {
  address: string | null
  isConnected: boolean
  isMiniPay: boolean
  connectWallet: () => void
  disconnectAll: () => void
  showChainSelect: boolean
  setShowChainSelect: (show: boolean) => void
  connect: () => Promise<void>
  connectSocial: () => Promise<void>
  disconnect: () => void
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  isConnected: false,
  isMiniPay: false,
  connectWallet: () => {},
  disconnectAll: () => {},
  showChainSelect: false,
  setShowChainSelect: () => {},
  connect: async () => {},
  connectSocial: async () => {},
  disconnect: () => {},
})

export const useWallet = () => useContext(WalletContext)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { address: evmAddress, isConnected: evmConnected } = useAccount()
  const { disconnect: wagmiDisconnect } = useDisconnect()

  const [isMiniPay, setIsMiniPay] = useState(false)
  const [showChainSelect, setShowChainSelect] = useState(false)

  const isConnected = evmConnected || !!evmAddress

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum?.isMiniPay) {
      setIsMiniPay(true)
    }
  }, [])

  const connect = useCallback(async () => {
    try {
      const { modal } = await import('@reown/appkit/react')
      await modal?.open()
    } catch (e) {
      console.error('Failed to open AppKit modal:', e)
    }
    setShowChainSelect(false)
  }, [])

  const connectSocial = useCallback(async () => {
    try {
      const { modal } = await import('@reown/appkit/react')
      await modal?.open({ view: 'Connect' })
      setShowChainSelect(false)
    } catch (e) {
      console.error('Social login failed:', e)
    }
  }, [])

  const disconnect = useCallback(() => {
    wagmiDisconnect()
  }, [wagmiDisconnect])

  const connectWallet = useCallback(() => {
    setShowChainSelect(true)
  }, [])

  const disconnectAll = useCallback(() => {
    disconnect()
  }, [disconnect])

  return (
    <WalletContext.Provider
      value={{
        address: evmAddress || null,
        isConnected,
        isMiniPay,
        connectWallet,
        disconnectAll,
        showChainSelect,
        setShowChainSelect,
        connect,
        connectSocial,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}
