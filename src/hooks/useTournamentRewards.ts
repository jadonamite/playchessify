'use client'

// Weekly Grand Prix prize claims. Purely on-chain driven: the card shows the
// latest seeded season from TournamentRewards.latestSeasonId and the connected
// player's claimStatus for it — no server round-trip, no stale Redis view.
// Claims dispatch through useCeloChess.sendWrite, so every wallet tier keeps
// its usual gas rail (paymaster / USDm fee currency / 2771 meta-tx).

import { usePublicClient } from 'wagmi'
import { formatUnits, type Address } from 'viem'
import { useCallback, useEffect, useState } from 'react'
import { REWARDS_ABI } from '@/config/abis'
import { CELO_CONTRACTS, CELO_CHAIN_ID } from '@/config/contracts'
import { useCeloChess } from '@/hooks/useCeloChess'
import { useWallet } from '@/components/wallet-provider'
import { useToastStore } from '@/hooks/useToastStore'

const LOG_PREFIX = '[useTournamentRewards]'
const USDM_DECIMALS = 18

export interface RewardStatus {
  seasonId: number
  /** Prize in whole USDm, '' when not a winner. */
  prize: string
  isWinner: boolean
  claimed: boolean
  /** Season is seeded and not swept — a winner's claim would succeed. */
  open: boolean
}

export function useTournamentRewards() {
  const publicClient = usePublicClient({ chainId: CELO_CHAIN_ID })
  const { playerAddress } = useWallet()
  const { sendWrite, ensureGasSponsored, assertCanSelfPay } = useCeloChess()
  const showToast = useToastStore((state) => state.showToast)

  const [status, setStatus] = useState<RewardStatus | null>(null)
  const [isClaiming, setIsClaiming] = useState(false)

  const refresh = useCallback(async () => {
    if (!publicClient || !playerAddress) return
    try {
      const seasonId = (await publicClient.readContract({
        address: CELO_CONTRACTS.rewards as Address,
        abi: REWARDS_ABI,
        functionName: 'latestSeasonId',
      })) as bigint
      if (seasonId === 0n) {
        setStatus(null) // nothing seeded yet — no card
        return
      }
      const [amount, claimed, open] = (await publicClient.readContract({
        address: CELO_CONTRACTS.rewards as Address,
        abi: REWARDS_ABI,
        functionName: 'claimStatus',
        args: [seasonId, playerAddress as Address],
      })) as readonly [bigint, boolean, boolean]

      setStatus({
        seasonId: Number(seasonId),
        prize: amount > 0n ? formatUnits(amount, USDM_DECIMALS) : '',
        isWinner: amount > 0n,
        claimed,
        open,
      })
    } catch (err) {
      console.warn(`${LOG_PREFIX} status read failed`, err)
    }
  }, [publicClient, playerAddress])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const claim = useCallback(async () => {
    if (!status?.isWinner || status.claimed || !publicClient) return
    setIsClaiming(true)
    try {
      const gas = await ensureGasSponsored()
      await assertCanSelfPay(gas)
      const hash = await sendWrite({
        address: CELO_CONTRACTS.rewards as Address,
        abi: REWARDS_ABI,
        functionName: 'claim',
        args: [BigInt(status.seasonId)],
      })
      await publicClient.waitForTransactionReceipt({ hash })
      showToast(`$${status.prize} prize claimed — congrats, champion!`, 'success')
      await refresh()
    } catch (err) {
      console.error(`${LOG_PREFIX} claim failed`, err)
      const m = (err instanceof Error ? err.message : '').toLowerCase()
      if (!m.includes('rejected') && !m.includes('denied') && !m.includes('self-pay not possible')) {
        showToast('Claim failed — please try again.', 'error')
      }
    } finally {
      setIsClaiming(false)
    }
  }, [status, publicClient, ensureGasSponsored, assertCanSelfPay, sendWrite, showToast, refresh])

  return { status, claim, isClaiming, refresh }
}
