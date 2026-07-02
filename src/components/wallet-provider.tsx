'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { usePrivy, useWallets, useCreateWallet } from '@privy-io/react-auth'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { useAccount, useDisconnect, useConnect, useConnectors } from 'wagmi'

// Capability tier drives how on-chain writes are sponsored:
//   'minipay' → legacy tx + USDm gas-drip (MiniPay can't sign typed payload)
//   'smart'   → ERC-4337 userOp sponsored by the Pimlico paymaster
//   'eoa'     → external injected wallet pays its own gas
export type WalletTier = 'minipay' | 'smart' | 'eoa'

interface WalletContextType {
  address: string | null
  // The on-chain identity used as the game "player": the smart-account address for
  // Tier A, otherwise the connected EOA. Always matches white/black on-chain.
  playerAddress: string | null
  isConnected: boolean
  isReady: boolean
  // True once the user's real on-chain identity is resolved (the smart account for
  // embedded users). Gate create/join/claim on this to avoid the EOA-split bug.
  identityReady: boolean
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
  playerAddress: null,
  isConnected: false,
  isReady: false,
  identityReady: false,
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

  // A user with an embedded Privy wallet WILL get a smart account — so their true
  // on-chain identity is the smart account, not the embedded EOA. We must not let
  // them act under the EOA in the window before the smart client resolves, or a
  // profile/game gets recorded under the wrong address (the dual-identity split).
  const hasEmbeddedWallet = wallets.some(
    (w) => w.connectorType === 'embedded' || w.walletClientType === 'privy',
  )
  const expectsSmartAccount = !isMiniPay && hasEmbeddedWallet
  const smartAccount = smartWalletClient?.account?.address ?? null

  // Safety valve: if the smart account never resolves, don't brick the user —
  // after a grace period fall back to the EOA (the alias self-heal covers the
  // rare split that creates).
  const [smartTimedOut, setSmartTimedOut] = useState(false)
  useEffect(() => {
    if (!expectsSmartAccount || smartAccount) {
      if (smartTimedOut) setSmartTimedOut(false)
      return
    }
    const t = setTimeout(() => setSmartTimedOut(true), 8_000)
    return () => clearTimeout(t)
  }, [expectsSmartAccount, smartAccount, smartTimedOut])

  // Capability tier — MiniPay first; an embedded user is 'smart' (even while the
  // account is still resolving) unless we've given up waiting; else external EOA.
  const walletTier: WalletTier = isMiniPay
    ? 'minipay'
    : expectsSmartAccount && (smartAccount || !smartTimedOut)
      ? 'smart'
      : 'eoa'

  // Pinned on-chain identity:
  //   • MiniPay / external EOA → the connected EOA
  //   • embedded (smart) user  → the smart account ONLY. Intentionally null until
  //     it resolves, so create/join/claim (which all bail on a null identity) wait
  //     instead of acting under the EOA. Degrades to the EOA only after the timeout.
  const playerAddress = isMiniPay
    ? address
    : expectsSmartAccount
      ? smartAccount ?? (smartTimedOut ? address : null)
      : address

  // Fully ready = connected AND the real identity is resolved (or we gave up waiting).
  const identityReady = isMiniPay
    ? !!address
    : expectsSmartAccount
      ? !!smartAccount || smartTimedOut
      : !!address
  const isReady = isConnected && !!playerAddress && identityReady

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
        playerAddress,
        isConnected,
        isReady,
        identityReady,
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
