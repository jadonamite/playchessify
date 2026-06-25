'use client'

import { useWriteContract, useAccount, usePublicClient } from 'wagmi'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { decodeEventLog, encodeFunctionData, type Abi, type Address } from 'viem'
import { CHESS_GAME_ABI, CHESS_TOKEN_ABI } from '@/config/abis'
import { CELO_CONTRACTS, TOKEN_DECIMALS, CELO_CHAIN_ID, USDM_ADDRESS } from '@/config/contracts'
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

// Minimum USDm (18 decimals) a MiniPay wallet needs on hand to pay gas for a write.
const MIN_GAS_USDM = 5_000_000_000_000_000n // 0.005 USDm
// Minimum native CELO an external (Tier C) wallet needs on hand to pay gas for a write.
const MIN_GAS_CELO = 5_000_000_000_000_000n // 0.005 CELO
const GAS_POLL_ATTEMPTS = 12
const GAS_POLL_INTERVAL_MS = 1_000

// Result of provisioning gas for a wallet.
//   'sponsored' → drip landed, wallet now funded
//   'has-gas'   → wallet already had enough
//   'self-pay'  → no sponsorship (other tiers, or faucet degraded) — user pays
type GasStatus = 'sponsored' | 'has-gas' | 'self-pay'

// Minimal ERC20 fragment for reading a wallet's USDm balance.
const ERC20_BALANCE_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const

// Heuristic: did a write fail because sponsorship (paymaster/bundler/userOp) was
// unavailable, rather than a genuine revert? Used to retry once and to message clearly.
function isSponsorshipError(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return (
    m.includes('paymaster') || m.includes('sponsor') || m.includes('bundler') ||
    m.includes('user operation') || m.includes('useroperation') || m.includes('aa2') || m.includes('aa3')
  )
}

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
  //   minipay → legacy tx with feeCurrency = USDm (gas paid from the server drip)
  //   eoa     → plain write, user pays
  const sendWrite = useCallback(
    async (req: WriteRequest): Promise<`0x${string}`> => {
      if (walletTier === 'smart' && smartClient) {
        const data = encodeFunctionData({
          abi: req.abi,
          functionName: req.functionName,
          args: req.args,
        })
        // Graceful degradation for Tier A: a Privy hosted paymaster can't be
        // disabled per-call (so we can't "self-pay" a smart account), but most
        // sponsorship failures are transient bundler/paymaster hiccups — retry once
        // before surfacing a clear, actionable error.
        try {
          return await smartClient.sendTransaction({ to: req.address, data })
        } catch (err) {
          if (!isSponsorshipError(err)) throw err
          console.warn(`${LOG_PREFIX} sponsored tx failed, retrying once`, err)
          await sleep(1500)
          return await smartClient.sendTransaction({ to: req.address, data })
        }
      }

      if (walletTier === 'minipay') {
        // viem's celo chain serializes feeCurrency for legacy fee-currency txns.
        return writeContractAsync({
          address: req.address,
          abi: req.abi,
          functionName: req.functionName,
          args: req.args,
          feeCurrency: USDM_ADDRESS,
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

  // Read a wallet's current USDm (gas) balance.
  const readUsdmBalance = useCallback(
    async (addr: Address): Promise<bigint> => {
      if (!publicClient) return 0n
      try {
        return (await publicClient.readContract({
          address: USDM_ADDRESS as Address,
          abi: ERC20_BALANCE_ABI,
          functionName: 'balanceOf',
          args: [addr],
        })) as bigint
      } catch {
        return 0n
      }
    },
    [publicClient],
  )

  // Poll until the dripped USDm actually lands (replaces a blind sleep): confirms
  // the wallet's own RPC view sees the gas before it estimates the next tx.
  const pollUntilGas = useCallback(
    async (addr: Address): Promise<boolean> => {
      for (let i = 0; i < GAS_POLL_ATTEMPTS; i++) {
        if ((await readUsdmBalance(addr)) >= MIN_GAS_USDM) return true
        await sleep(GAS_POLL_INTERVAL_MS)
      }
      return false
    },
    [readUsdmBalance],
  )

  // Read a wallet's current native CELO balance.
  const readCeloBalance = useCallback(
    async (addr: Address): Promise<bigint> => {
      if (!publicClient) return 0n
      try {
        return await publicClient.getBalance({ address: addr })
      } catch {
        return 0n
      }
    },
    [publicClient],
  )

  // Poll until the dripped CELO actually lands.
  const pollUntilCeloGas = useCallback(
    async (addr: Address): Promise<boolean> => {
      for (let i = 0; i < GAS_POLL_ATTEMPTS; i++) {
        if ((await readCeloBalance(addr)) >= MIN_GAS_CELO) return true
        await sleep(GAS_POLL_INTERVAL_MS)
      }
      return false
    },
    [readCeloBalance],
  )

  // ── MiniPay gas provisioning (Tier B) ────────────────────────────────────────
  // Ensure a MiniPay wallet has USDm gas before it writes. No-op (→ 'self-pay') for
  // other tiers. Degrades gracefully: if the wallet already has gas, if the faucet
  // is exhausted, or if the request fails, we fall through to self-pay instead of
  // blocking — the caller then decides whether the user can actually cover it.
  //
  // Tier C (external EOA) gets the same "free first transaction" treatment, but
  // dripped in native CELO (the currency they actually pay gas in) instead of USDm.
  const ensureGasSponsored = useCallback(async (): Promise<GasStatus> => {
    if (!playerAddress) return 'self-pay'
    const addr = playerAddress as Address

    if (walletTier === 'minipay') {
      if ((await readUsdmBalance(addr)) >= MIN_GAS_USDM) return 'has-gas'

      try {
        const res = await fetch('/api/gas/sponsor', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ address: addr, chain: 'celo', tier: 'minipay' }),
        })
        const body = (await res.json().catch(() => ({}))) as { degraded?: boolean }
        if (body?.degraded) {
          showToast('Gasless service is busy — using your USDm for gas.', 'info')
          return 'self-pay'
        }
      } catch (err) {
        console.warn(`${LOG_PREFIX} gas sponsor request failed (degrading to self-pay)`, err)
        return 'self-pay'
      }

      // Confirm the drip landed before continuing.
      return (await pollUntilGas(addr)) ? 'sponsored' : 'self-pay'
    }

    if (walletTier === 'eoa') {
      if ((await readCeloBalance(addr)) >= MIN_GAS_CELO) return 'has-gas'

      try {
        const res = await fetch('/api/gas/sponsor', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ address: addr, chain: 'celo', tier: 'eoa' }),
        })
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; degraded?: boolean; skipped?: boolean }
        if (!body?.ok || body?.degraded || body?.skipped) return 'self-pay'
      } catch (err) {
        console.warn(`${LOG_PREFIX} gas sponsor request failed (degrading to self-pay)`, err)
        return 'self-pay'
      }

      if (!(await pollUntilCeloGas(addr))) return 'self-pay'
      showToast('Playchessify sent you some gas for this transaction — get some CELO of your own for next time.', 'info')
      return 'sponsored'
    }

    return 'self-pay'
  }, [walletTier, playerAddress, readUsdmBalance, pollUntilGas, readCeloBalance, pollUntilCeloGas, showToast])

  // When sponsorship didn't cover the wallet, make sure the user can actually
  // self-pay; otherwise stop with a clear, actionable message instead of a
  // cryptic wallet gas-estimation error.
  const assertCanSelfPay = useCallback(
    async (status: GasStatus): Promise<void> => {
      if (status !== 'self-pay' || !playerAddress) return

      if (walletTier === 'minipay') {
        if ((await readUsdmBalance(playerAddress as Address)) < MIN_GAS_USDM) {
          showToast('Free gas is temporarily unavailable and your wallet has no USDm for gas. Add a little USDm and try again.', 'error')
          throw new Error(`${LOG_PREFIX} self-pay not possible: no USDm for gas`)
        }
        return
      }

      if (walletTier === 'eoa') {
        if ((await readCeloBalance(playerAddress as Address)) < MIN_GAS_CELO) {
          showToast('Free gas is temporarily unavailable and your wallet has no CELO for gas. Add a little CELO and try again.', 'error')
          throw new Error(`${LOG_PREFIX} self-pay not possible: no CELO for gas`)
        }
      }
    },
    [walletTier, playerAddress, readUsdmBalance, readCeloBalance, showToast],
  )

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
      const message = (err instanceof Error ? err.message : '').toLowerCase()
      const userCancelled =
        message.includes('rejected') || message.includes('user denied') || message.includes('cancelled')
      if (userCancelled) showToast('Transaction cancelled by user.', 'error')
      else if (isSponsorshipError(err))
        showToast('Sponsored (gasless) transaction is unavailable right now — please retry in a moment.', 'error')
      else if (!message.includes('insufficient balance') && !message.includes('no usdm for gas') && !message.includes('no celo for gas'))
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
        const gas = await ensureGasSponsored()
        await assertCanSelfPay(gas)
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
    [playerAddress, publicClient, ensureGasSponsored, assertCanSelfPay, ensureBalance, ensureApproval, sendWrite, showToast, handleTxError],
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
        const gas = await ensureGasSponsored()
        await assertCanSelfPay(gas)
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
    [playerAddress, publicClient, ensureGasSponsored, assertCanSelfPay, ensureBalance, ensureApproval, sendWrite, showToast, handleTxError],
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

  // ── proposeDraw / acceptDraw ─────────────────────────────────────────────────
  const proposeDraw = useCallback(
    async (gameId: number) => {
      console.info(`${LOG_PREFIX} proposeDraw`, { gameId })
      await ensureGasSponsored()
      try {
        return await sendWrite({
          address: CELO_CONTRACTS.game as Address,
          abi: CHESS_GAME_ABI,
          functionName: 'proposeDraw',
          args: [BigInt(gameId)],
        })
      } catch (err) {
        console.error(`${LOG_PREFIX} proposeDraw failed:`, err)
        throw err
      }
    },
    [sendWrite, ensureGasSponsored],
  )

  const acceptDraw = useCallback(
    async (gameId: number) => {
      console.info(`${LOG_PREFIX} acceptDraw`, { gameId })
      await ensureGasSponsored()
      try {
        return await sendWrite({
          address: CELO_CONTRACTS.game as Address,
          abi: CHESS_GAME_ABI,
          functionName: 'acceptDraw',
          args: [BigInt(gameId)],
        })
      } catch (err) {
        console.error(`${LOG_PREFIX} acceptDraw failed:`, err)
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

  return { createGame, joinGame, resign, proposeDraw, acceptDraw, requestSettle, isPending }
}
