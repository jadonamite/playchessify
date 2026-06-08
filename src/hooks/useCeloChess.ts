'use client'

import { useWriteContract, useAccount, usePublicClient } from 'wagmi'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { decodeEventLog, encodeFunctionData, type Abi, type Address } from 'viem'
import { CHESS_GAME_ABI, CHESS_TOKEN_ABI } from '@/config/abis'
import { CELO_CONTRACTS, TOKEN_DECIMALS, CELO_CHAIN_ID, CUSD_ADDRESS } from '@/config/contracts'
import { parseUnits } from 'viem'
import { useCallback, useState } from 'react'
import { useToastStore } from '@/hooks/useToastStore'
import { useWallet } from '@/components/wallet-provider'

const LOG_PREFIX = '[useCeloChess]'
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Option A — approve a large-but-finite allowance so repeat games skip the approve tx
// (the allowance check below only re-approves once this is exhausted). A finite cap keeps
// wallets from showing the scary "unlimited approval" warning.
const APPROVAL_ALLOWANCE = parseUnits('1000000', TOKEN_DECIMALS) // 1,000,000 CHESS

interface WriteRequest {
  address: Address
  abi: Abi
  functionName: string
  args: readonly unknown[]
}

export function useCeloChess() {
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient({ chainId: CELO_CHAIN_ID })
  const { walletTier } = useWallet()
  const { client: smartClient } = useSmartWallets()
  const [isPending, setIsPending] = useState(false)
  const showToast = useToastStore((state) => state.showToast)

  // The on-chain "player" identity. For Tier A this is the smart-account address
  // (not the embedded EOA); for B/C it's the connected EOA.
  const playerAddress: Address | undefined =
    walletTier === 'smart' && smartClient?.account
      ? (smartClient.account.address as Address)
      : (address as Address | undefined)

  // ── tier-aware write dispatch ────────────────────────────────────────────────
  // One helper isolates the per-tier sponsorship mechanism so createGame/joinGame/
  // approve stay readable:
  //   smart   → Privy smart-wallet client → Pimlico paymaster sponsors the userOp
  //   minipay → legacy tx with feeCurrency = cUSD (gas paid from the server drip)
  //   eoa     → plain write, user pays
  const sendWrite = useCallback(
    async (req: WriteRequest): Promise<`0x${string}`> => {
      if (walletTier === 'smart' && smartClient) {
        const data = encodeFunctionData({
          abi: req.abi,
          functionName: req.functionName,
          args: req.args,
        })
        return smartClient.sendTransaction({ to: req.address, data })
      }

      if (walletTier === 'minipay') {
        // viem's celo chain serializes feeCurrency for legacy fee-currency txns.
        return writeContractAsync({
          address: req.address,
          abi: req.abi,
          functionName: req.functionName,
          args: req.args,
          feeCurrency: CUSD_ADDRESS,
        } as Parameters<typeof writeContractAsync>[0])
      }

      return writeContractAsync({
        address: req.address,
        abi: req.abi,
        functionName: req.functionName,
        args: req.args,
      } as Parameters<typeof writeContractAsync>[0])
    },
    [walletTier, smartClient, writeContractAsync],
  )

  // ── MiniPay gas provisioning ─────────────────────────────────────────────────
  // Before a MiniPay wallet writes, ensure it has cUSD gas (+ CHESS). Idempotent on
  // the server; a no-op for other tiers.
  const ensureGasSponsored = useCallback(async () => {
    if (walletTier !== 'minipay' || !playerAddress) return
    try {
      await fetch('/api/gas/sponsor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: playerAddress, chain: 'celo' }),
      })
      // Give the drip a moment to land before the wallet estimates gas.
      await sleep(1500)
    } catch (err) {
      console.warn(`${LOG_PREFIX} gas sponsor request failed (continuing)`, err)
    }
  }, [walletTier, playerAddress])

  // ── shared steps ─────────────────────────────────────────────────────────────
  const ensureBalance = useCallback(
    async (amount: bigint, wagerAmount: number): Promise<void> => {
      if (!publicClient || !playerAddress) throw new Error(`${LOG_PREFIX} not ready`)
      const balance = (await publicClient.readContract({
        address: CELO_CONTRACTS.token as Address,
        abi: CHESS_TOKEN_ABI,
        functionName: 'balanceOf',
        args: [playerAddress],
      })) as bigint
      if (balance < amount) {
        showToast(`Insufficient CHESS balance. You need ${wagerAmount} CHESS.`, 'error')
        throw new Error(`${LOG_PREFIX} Insufficient balance`)
      }
    },
    [publicClient, playerAddress, showToast],
  )

  const ensureApproval = useCallback(
    async (amount: bigint): Promise<void> => {
      if (!publicClient || !playerAddress) throw new Error(`${LOG_PREFIX} not ready`)

      const allowance = (await publicClient.readContract({
        address: CELO_CONTRACTS.token as Address,
        abi: CHESS_TOKEN_ABI,
        functionName: 'allowance',
        args: [playerAddress, CELO_CONTRACTS.game as Address],
      })) as bigint
      if (allowance >= amount) {
        console.info(`${LOG_PREFIX} allowance sufficient (${allowance} >= ${amount})`)
        return
      }

      showToast('Please approve the CHESS token spending limit...', 'info')
      const approveHash = await sendWrite({
        address: CELO_CONTRACTS.token as Address,
        abi: CHESS_TOKEN_ABI,
        functionName: 'approve',
        args: [CELO_CONTRACTS.game as Address, amount > APPROVAL_ALLOWANCE ? amount : APPROVAL_ALLOWANCE],
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash: approveHash })
      if (receipt.status !== 'success') {
        showToast('Approval transaction reverted.', 'error')
        throw new Error(`${LOG_PREFIX} approve reverted (${approveHash})`)
      }
      showToast('Spending limit approved!', 'info')
      // Prevent wallet provider nonce out-of-sync conflicts before the next tx.
      await sleep(1500)
    },
    [publicClient, playerAddress, sendWrite, showToast],
  )

  const handleTxError = useCallback(
    (err: unknown) => {
      console.error(`${LOG_PREFIX} tx failed:`, err)
      const msg = (err instanceof Error ? err.message : '').toLowerCase()
      const userCancelled =
        msg.includes('rejected') || msg.includes('user denied') || msg.includes('cancelled')
      if (userCancelled) showToast('Transaction cancelled by user.', 'error')
      else if (!msg.includes('insufficient balance'))
        showToast('Blockchain interaction failed. Please check your transaction and try again.', 'error')
    },
    [showToast],
  )

  // ── createGame ──────────────────────────────────────────────────────────────
  const createGame = useCallback(
    async (wagerAmount: number): Promise<number | null> => {
      if (!playerAddress) {
        showToast('Wallet not connected', 'error')
        throw new Error(`${LOG_PREFIX} createGame: wallet not connected`)
      }
      if (!publicClient) {
        showToast('Blockchain node connection unavailable', 'error')
        throw new Error(`${LOG_PREFIX} createGame: public client unavailable`)
      }

      setIsPending(true)
      try {
        const amount = parseUnits(wagerAmount.toString(), TOKEN_DECIMALS)
        await ensureGasSponsored()
        if (amount > 0n) {
          await ensureBalance(amount, wagerAmount)
          await ensureApproval(amount)
        }

        showToast('Please confirm the match initialization...', 'info')
        const createHash = await sendWrite({
          address: CELO_CONTRACTS.game as Address,
          abi: CHESS_GAME_ABI,
          functionName: 'createGame',
          args: [amount],
        })
        const receipt = await publicClient.waitForTransactionReceipt({ hash: createHash })
        if (receipt.status !== 'success') {
          showToast('Match creation transaction reverted.', 'error')
          throw new Error(`${LOG_PREFIX} createGame reverted (${createHash})`)
        }

        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({ abi: CHESS_GAME_ABI, data: log.data, topics: log.topics })
            if (decoded.eventName === 'GameCreated') {
              const args = decoded.args as unknown as { gameId: bigint }
              const gameId = Number(args.gameId)
              showToast('Match initialized successfully!', 'success')
              return gameId
            }
          } catch {
            // log belongs to a different contract — skip
          }
        }
        throw new Error(`${LOG_PREFIX} createGame: GameCreated event not found (${createHash})`)
      } catch (err) {
        handleTxError(err)
        throw err
      } finally {
        setIsPending(false)
      }
    },
    [playerAddress, publicClient, ensureGasSponsored, ensureBalance, ensureApproval, sendWrite, showToast, handleTxError],
  )

  // ── joinGame ────────────────────────────────────────────────────────────────
  const joinGame = useCallback(
    async (gameId: number, wagerAmount: number): Promise<void> => {
      if (!playerAddress) {
        showToast('Wallet not connected', 'error')
        throw new Error(`${LOG_PREFIX} joinGame: wallet not connected`)
      }
      if (!publicClient) {
        showToast('Blockchain node connection unavailable', 'error')
        throw new Error(`${LOG_PREFIX} joinGame: public client unavailable`)
      }

      setIsPending(true)
      try {
        const amount = parseUnits(wagerAmount.toString(), TOKEN_DECIMALS)
        await ensureGasSponsored()
        if (amount > 0n) {
          await ensureBalance(amount, wagerAmount)
          await ensureApproval(amount)
        }

        showToast('Please confirm the transaction to join this match...', 'info')
        const joinHash = await sendWrite({
          address: CELO_CONTRACTS.game as Address,
          abi: CHESS_GAME_ABI,
          functionName: 'joinGame',
          args: [BigInt(gameId)],
        })
        const receipt = await publicClient.waitForTransactionReceipt({ hash: joinHash })
        if (receipt.status !== 'success') {
          showToast('Match joining transaction reverted.', 'error')
          throw new Error(`${LOG_PREFIX} joinGame reverted (${joinHash})`)
        }
        showToast('Successfully joined the match!', 'success')
      } catch (err) {
        handleTxError(err)
        throw err
      } finally {
        setIsPending(false)
      }
    },
    [playerAddress, publicClient, ensureGasSponsored, ensureBalance, ensureApproval, sendWrite, showToast, handleTxError],
  )

  // ── resign ──────────────────────────────────────────────────────────────────
  const resign = useCallback(
    async (gameId: number) => {
      console.info(`${LOG_PREFIX} resign`, { gameId })
      await ensureGasSponsored()
      try {
        return await sendWrite({
          address: CELO_CONTRACTS.game as Address,
          abi: CHESS_GAME_ABI,
          functionName: 'resign',
          args: [BigInt(gameId)],
        })
      } catch (err) {
        console.error(`${LOG_PREFIX} resign failed:`, err)
        throw err
      }
    },
    [sendWrite, ensureGasSponsored],
  )

  // ── requestSettle ────────────────────────────────────────────────────────────
  // Ask the server to replay the game and settle it on-chain via the oracle.
  // Idempotent: safe for either client to call once the board is terminal.
  const requestSettle = useCallback(async (gameId: number): Promise<boolean> => {
    console.info(`${LOG_PREFIX} requestSettle`, { gameId })
    try {
      const res = await fetch(`/api/games/celo/${gameId}/settle`, { method: 'POST' })
      return res.ok
    } catch (err) {
      console.error(`${LOG_PREFIX} requestSettle failed:`, err)
      return false
    }
  }, [])

  return { createGame, joinGame, resign, requestSettle, isPending }
}
