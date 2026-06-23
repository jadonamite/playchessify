'use client'
import { useCallback } from 'react'
import { useSignMessage } from 'wagmi'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { useWallet } from '@/components/wallet-provider'

/**
 * Returns a `signMove` that signs the canonical move message with whichever
 * wallet controls the on-chain identity:
 * Tier A (smart) → smart-account signature (EIP-1271, verified server-side)
 * Tier C (eoa) → plain EOA signature
 * Tier B (minipay) → null — MiniPay cannot sign messages, so the move is
 * authenticated by the relay's participant/turn binding only.
 */
export function useMoveSigner() {
  const { walletTier } = useWallet()
  const { client: smartClient } = useSmartWallets()
  const { signMessageAsync } = useSignMessage()

  const signMove = useCallback(
    async (message: string): Promise<`0x${string}` | null> => {
      if (walletTier === 'minipay') return null
      try {
        if (walletTier === 'smart' && smartClient) {
          return await smartClient.signMessage({ message })
        }
        if (walletTier === 'eoa') {
          return await signMessageAsync({ message })
        }
      } catch (err) {
        console.warn('[useMoveSigner] sign failed, submitting unsigned', err)
      }
      return null
    },
    [walletTier, smartClient, signMessageAsync],
  )

  const canSign = walletTier !== 'minipay'
  return { signMove, canSign }
}