'use client'

// Weekly Grand Prix prize claims. The winner whitelist comes from the frozen
// final board (/api/tournament/rewards) the moment a season concludes — the
// banner goes live before the vault is seeded on-chain. On-chain claimStatus
// overlays it: once openSeason runs, `funded` flips and the CLAIM tx goes
// through; before that, winners get a "not yet funded" error on click.
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
  /** Season has been seeded on-chain — a winner's claim would succeed. */
  funded: boolean
}

interface RewardsApi {
  seasonId: number
  winners: { address: string; amount: number }[]
}

export function useTournamentRewards() {
  const publicClient = usePublicClient({ chainId: CELO_CHAIN_ID })
  const { playerAddress } = useWallet()
  const { sendWrite, ensureGasSponsored, assertCanSelfPay } = useCeloChess()
  const showToast = useToastStore((state) => state.showToast)

  const [status, setStatus] = useState<RewardStatus | null>(null)
  const [isClaiming, setIsClaiming] = useState(false)

  const refresh = useCallback(async () => {
    if (!playerAddress) return
    try {
      // 1. The frozen board is the whitelist of record — live pre-funding.
      const res = await fetch('/api/tournament/rewards')
      if (!res.ok) return
      const api = (await res.json()) as RewardsApi
      if (!api.seasonId || api.winners.length === 0) {
        setStatus(null) // no concluded season yet — no banner
        return
      }
      const me = playerAddress.toLowerCase()
      const mine = api.winners.find((w) => w.address.toLowerCase() === me)

      // 2. On-chain overlay: funded once openSeason has run; claimed sticks.
      let funded = false
      let claimed = false
      let prize = mine ? String(mine.amount) : ''
      if (publicClient) {
        try {
          const [amount, claimed_, open] = (await publicClient.readContract({
            address: CELO_CONTRACTS.rewards as Address,
            abi: REWARDS_ABI,
            functionName: 'claimStatus',
            args: [BigInt(api.seasonId), playerAddress as Address],
          })) as readonly [bigint, boolean, boolean]
          funded = open
          claimed = claimed_
          if (amount > 0n) prize = formatUnits(amount, USDM_DECIMALS)
        } catch (err) {
          console.warn(`${LOG_PREFIX} on-chain overlay failed`, err)
        }
      }

      setStatus({
        seasonId: api.seasonId,
        prize,
        isWinner: Boolean(mine),
        claimed,
        funded,
      })
    } catch (err) {
      console.warn(`${LOG_PREFIX} status read failed`, err)
    }
  }, [publicClient, playerAddress])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const claim = useCallback(async () => {
    if (!status || status.claimed || !publicClient) return

    // Everyone gets the same button — the answer only lands after a beat of
    // "checking", so the banner never spoils who's on the whitelist up front.
    if (!status.isWinner || !status.funded) {
      setIsClaiming(true)
      await new Promise((r) => setTimeout(r, 1800))
      setIsClaiming(false)
      showToast(
        !status.isWinner
          ? 'Sorry, you are not eligible — try again next season.'
          : 'Contract not yet funded — try again later.',
        'error',
      )
      return
    }
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
