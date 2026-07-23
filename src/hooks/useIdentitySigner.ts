'use client'

import { useCallback } from 'react'
import { useWallet } from '@/components/wallet-provider'
import { useSignMessage } from 'wagmi'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'

/**
 * Signs an off-chain identity message (profile claim / update) with the wallet
 * that controls the on-chain player identity:
 *   Tier A (smart) → the smart account, via EIP-1271 (and ERC-6492 while the
 *                    account is still counterfactual / undeployed)
 *   Tier B/C       → the connected EOA (which *is* the player address)
 *
 * The wagmi `useSignMessage` alone signs with the embedded EOA, whose address
 * does not match the smart-account player address — so those signatures fail
 * verification. Must be paired server-side with a client-based verifier
 * (verifyWalletSignature) that understands 1271/6492.
 */
export function useIdentitySigner() {
  const { walletTier } = useWallet()
  const { client: smartClient } = useSmartWallets()
  const { signMessageAsync } = useSignMessage()

  return useCallback(
    async (message: string): Promise<`0x${string}`> => {
      if (walletTier === 'smart' && smartClient) {
        return smartClient.signMessage({ message })
      }
      return signMessageAsync({ message })
    },
    [walletTier, smartClient, signMessageAsync],
  )
}
