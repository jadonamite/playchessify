'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { usePrivy, useWallets, useCreateWallet } from '@privy-io/react-auth'
import { useAccount, useDisconnect, useConnect, useConnectors } from 'wagmi'

interface WalletContextType {
  address: string | null
  isConnected: boolean
  isReady: boolean
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
  isReady: false,
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
  const { wallets } = useWallets()
  const { createWallet } = useCreateWallet()
  const { disconnect: wagmiDisconnect } = useDisconnect()
  const { connect } = useConnect()
  const connectors = useConnectors()

  const [isMiniPay, setIsMiniPay] = useState(false)
  const [showChainSelect, setShowChainSelect] = useState(false)
  const miniPayConnectTried = useRef(false)

  // Prefer wagmi (external wallet), fall back to Privy embedded wallet
  const privyAddress = wallets[0]?.address as `0x${string}` | undefined
  const address = evmAddress ?? privyAddress ?? null

  // Authenticated via Privy, OR auto-connected MiniPay (injected wallet, no Privy session)
  const isConnected = (ready && authenticated) || (isMiniPay && !!evmAddress)
  // Fully ready = connected + has wallet address
  const isReady = isConnected && !!address

  // MiniPay runs the dApp in an in-app browser with an injected wallet.
  // Detect it and auto-connect the injected connector — MiniPay grants without
  // a prompt, so the user lands logged-in without tapping "connect".
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!(window as any).ethereum?.isMiniPay) return
    setIsMiniPay(true)
    if (miniPayConnectTried.current || evmAddress) return
    const injectedConnector = connectors.find((c) => c.type === 'injected')
    if (!injectedConnector) return
    miniPayConnectTried.current = true
    connect({ connector: injectedConnector })
  }, [connectors, connect, evmAddress])

  // If authenticated but no wallet exists yet, create one explicitly
  useEffect(() => {
    if (!ready || !authenticated) return
    if (wallets.length === 0 && !evmAddress) {
      createWallet().catch(() => {})
    }
  }, [ready, authenticated, wallets.length, evmAddress, createWallet])

  const connect = useCallback(async () => {
    if (authenticated) return // already logged in, don't re-trigger
    login()
    setShowChainSelect(false)
  }, [login, authenticated])

  const connectSocial = useCallback(async () => {
    if (authenticated) return
    login()
    setShowChainSelect(false)
  }, [login, authenticated])

  const disconnect = useCallback(() => {
    logout()
    wagmiDisconnect()
  }, [logout, wagmiDisconnect])

  const connectWallet = useCallback(() => {
    if (authenticated) return
    login()
  }, [login, authenticated])

  const disconnectAll = useCallback(() => {
    disconnect()
  }, [disconnect])

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected,
        isReady,
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
