'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { usePrivy, useWallets, useCreateWallet } from '@privy-io/react-auth'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { useAccount, useDisconnect, useConnect, useConnectors } from 'wagmi'

// Capability tier drives how on-chain writes are sponsored:
//   'minipay' → legacy tx + cUSD gas-drip (MiniPay can't sign typed data)
//   'smart'   → ERC-4337 userOp sponsored by the Pimlico paymaster
//   'eoa'     → external injected wallet pays its own gas
export type WalletTier = 'minipay' | 'smart' | 'eoa'

interface WalletContextType {
  address: string | null
  isConnected: boolean
  isReady: boolean
  isMiniPay: boolean
  walletTier: WalletTier
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
  walletTier: 'eoa',
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
  const { connect: wagmiConnect } = useConnect()
  const connectors = useConnectors()
  const { client: smartWalletClient } = useSmartWallets()

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

  // Capability tier — MiniPay first (most constrained), then a Privy smart wallet
  // if one is active, otherwise a plain external EOA.
  const walletTier: WalletTier = isMiniPay
    ? 'minipay'
    : smartWalletClient?.account
      ? 'smart'
      : 'eoa'

  // MiniPay runs the dApp in an in-app browser with an injected wallet.
  // Detect it and auto-connect the injected connector — MiniPay grants without
  // a prompt, so the user lands logged-in without tapping "connect".
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!(window as unknown as { ethereum?: { isMiniPay?: boolean } }).ethereum?.isMiniPay) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time MiniPay environment detection
    setIsMiniPay(true)
    if (miniPayConnectTried.current || evmAddress) return
    const injectedConnector = connectors.find((c) => c.type === 'injected')
    if (!injectedConnector) return
    miniPayConnectTried.current = true
    wagmiConnect({ connector: injectedConnector })
  }, [connectors, wagmiConnect, evmAddress])

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
        walletTier,
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
