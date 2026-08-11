'use client'

import { useEffect, useRef } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { useWelcomeGate } from '@/hooks/useWelcomeGate'
import { useWallet } from '@/components/wallet-provider'

const LOG_PREFIX = '[useProfileLink]'

/**
 * Self-heals the dual-identity split for Privy smart-wallet users. A Privy user
 * has two addresses — the embedded EOA (owner/signer) and the smart account (the
 * on-chain player the paymaster sponsors). If a profile was claimed under one but
 * a game recorded under the other, the name goes missing on the leaderboard/game.
 *
 * Once both addresses are known, we link them (one signature from the EOA, which
 * owns the smart account) so a single .chess name resolves for both. Runs at most
 * once per address-pair per device. Off-chain only — never touches transactions
 * or the paymaster.
 */
export function useProfileLink() {
  const { address: eoa } = useAccount()
  const { client: smartClient } = useSmartWallets()
  const { signMessageAsync } = useSignMessage()
  const welcomeDismissed = useWelcomeGate((s) => s.dismissed)
  const { walletTier } = useWallet()
  const tried = useRef<Set<string>>(new Set())

  useEffect(() => {
    // Hold the link signature until the first-timer welcome is dismissed, so a
    // fresh user sees the welcome first — never a signature prompt over it.
    if (!welcomeDismissed) return
    // Only a player actually operating as their smart account has a split to
    // heal. useSmartWallets returns a client whenever Privy holds a smart wallet
    // for the account — which outlives the login that created it — so someone
    // who later connects an external EOA still resolves one. Asking them to sign
    // prompts a merge into a smart account they never chose and do not
    // recognise. walletTier is the provider's answer to "which wallet is this
    // player actually using"; defer to it rather than to the client existing.
    if (walletTier !== 'smart') return
    const smart = smartClient?.account?.address
    if (!eoa || !smart) return
    if (eoa.toLowerCase() === smart.toLowerCase()) return

    const key = `${eoa.toLowerCase()}:${smart.toLowerCase()}`
    if (tried.current.has(key)) return
    try { if (localStorage.getItem(`chess:linked:${key}`)) return } catch { /* private mode */ }
    tried.current.add(key)

    ;(async () => {
      try {
        const timestamp = new Date().toISOString()
        const message = `Chessify Identity Link\n\nEOA: ${eoa.toLowerCase()}\nSmart: ${smart.toLowerCase()}\nTimestamp: ${timestamp}`
        const signature = await signMessageAsync({ message })
        const res = await fetch('/api/profile/link', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ eoa, smart, signature, timestamp }),
        })
        if (res.ok) {
          try { localStorage.setItem(`chess:linked:${key}`, '1') } catch { /* ignore */ }
        } else {
          tried.current.delete(key) // allow a retry on a later mount
        }
      } catch (err) {
        // user dismissed the sign, or a transient failure — retry on a later mount
        console.warn(`${LOG_PREFIX} link skipped`, err)
        tried.current.delete(key)
      }
    })()
  }, [eoa, smartClient, signMessageAsync, welcomeDismissed, walletTier])
}
