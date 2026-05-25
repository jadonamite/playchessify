'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { usePrivy } from '@privy-io/react-auth'
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
  const { login, logout, authenticated, ready } = usePrivy()
  const { address: evmAddress } = useAccount()
  const { disconnect: wagmiDisconnect } = useDisconnect()

  const [isMiniPay, setIsMiniPay] = useState(false)
  const [showChainSelect, setShowChainSelect] = useState(false)

  const isConnected = (ready && authenticated) || !!evmAddress

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum?.isMiniPay) {
      setIsMiniPay(true)
    }
  }, [])

  const connect = useCallback(async () => {
    login()
    setShowChainSelect(false)
  }, [login])

  // Social login and wallet login both go through Privy's unified modal
  const connectSocial = useCallback(async () => {
    login()
    setShowChainSelect(false)
  }, [login])

  const disconnect = useCallback(() => {
    logout()
    wagmiDisconnect()
  }, [logout, wagmiDisconnect])

  const connectWallet = useCallback(() => {
    login()
  }, [login])

  const disconnectAll = useCallback(() => {
    disconnect()
  }, [disconnect])

  // Resolve address: prefer wagmi account (external wallet), fall back to Privy embedded wallet
  const address = evmAddress ?? null

  return (
    <WalletContext.Provider
      value={{
        address,
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
