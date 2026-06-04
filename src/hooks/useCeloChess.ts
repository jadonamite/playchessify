'use client'

import { useWriteContract, useAccount, usePublicClient } from 'wagmi'
import { decodeEventLog } from 'viem'
import { CHESS_GAME_ABI, CHESS_TOKEN_ABI } from '@/config/abis'
import { CELO_CONTRACTS, TOKEN_DECIMALS, CELO_CHAIN_ID } from '@/config/contracts'
import { parseUnits } from 'viem'
import { useState, useCallback } from 'react'
import { useToastStore } from '@/hooks/useToastStore'

const LOG_PREFIX = '[useCeloChess]'
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function useCeloChess() {
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient({ chainId: CELO_CHAIN_ID })
  const [isPending, setIsPending] = useState(false)
  const showToast = useToastStore((state) => state.showToast)

  // ── createGame ──────────────────────────────────────────────────────────────
  const createGame = useCallback(async (wagerAmount: number): Promise<number | null> => {
    if (!address) {
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

      // Check current CHESS token balance
      console.info(`${LOG_PREFIX} checking CHESS balance for ${address}`)
      const balance = await publicClient.readContract({
        address: CELO_CONTRACTS.token as `0x${string}`,
        abi: CHESS_TOKEN_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      }) as bigint

      if (balance < amount) {
        showToast(`Insufficient CHESS balance. You need ${wagerAmount} CHESS.`, 'error')
        throw new Error(`${LOG_PREFIX} createGame: Insufficient balance`)
      }

      // Check current allowance for the game contract
      console.info(`${LOG_PREFIX} checking allowance for game contract`)
      const allowance = await publicClient.readContract({
        address: CELO_CONTRACTS.token as `0x${string}`,
        abi: CHESS_TOKEN_ABI,
        functionName: 'allowance',
        args: [address as `0x${string}`, CELO_CONTRACTS.game as `0x${string}`],
      }) as bigint

      if (allowance < amount) {
        // Step 1 — approve, wait for confirmation before proceeding
        console.info(`${LOG_PREFIX} createGame: sending approve`, { wager: wagerAmount })
        showToast('Please approve the CHESS token spending limit in your wallet...', 'info')
        const approveTxHash = await writeContractAsync({
          address: CELO_CONTRACTS.token as `0x${string}`,
          abi: CHESS_TOKEN_ABI,
          functionName: 'approve',
          args: [CELO_CONTRACTS.game as `0x${string}`, amount],
        })

        const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTxHash })
        if (approveReceipt.status !== 'success') {
          showToast('Approval transaction reverted.', 'error')
          throw new Error(`${LOG_PREFIX} createGame: approve tx reverted (${approveTxHash})`)
        }
        console.info(`${LOG_PREFIX} createGame: approve confirmed`, { hash: approveTxHash })
        showToast('Spending limit approved! Waiting to broadcast game creation...', 'info')
        
        // Add a sleep delay to prevent wallet provider nonce out-of-sync conflicts
        await sleep(1500)
      } else {
        console.info(`${LOG_PREFIX} createGame: allowance already sufficient (${allowance} >= ${amount})`)
      }

      // Step 2 — create game
      console.info(`${LOG_PREFIX} createGame: sending createGame`, { wager: wagerAmount })
      showToast('Please confirm the match initialization in your wallet...', 'info')
      const createTxHash = await writeContractAsync({
        address: CELO_CONTRACTS.game as `0x${string}`,
        abi: CHESS_GAME_ABI,
        functionName: 'createGame',
        args: [amount],
      })

      const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createTxHash })
      if (createReceipt.status !== 'success') {
        showToast('Match creation transaction reverted.', 'error')
        throw new Error(`${LOG_PREFIX} createGame: createGame tx reverted (${createTxHash})`)
      }

      // Parse GameCreated event to extract game ID
      for (const log of createReceipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: CHESS_GAME_ABI, data: log.data, topics: log.topics })
          if (decoded.eventName === 'GameCreated') {
            const args = decoded.args as unknown as { gameId: bigint }
            const gameId = Number(args.gameId)
            console.info(`${LOG_PREFIX} createGame: success`, { gameId, hash: createTxHash })
            showToast('Match initialized successfully!', 'success')
            return gameId
          }
        } catch {
          // log belongs to a different contract — skip
        }
      }

      throw new Error(`${LOG_PREFIX} createGame: GameCreated event not found in receipt (${createTxHash})`)
    } catch (err) {
      console.error(`${LOG_PREFIX} createGame failed:`, err)
      const msg = (err instanceof Error ? err.message : '').toLowerCase()
      const userCancelled = msg.includes('rejected') || msg.includes('user denied') || msg.includes('cancelled')
      if (userCancelled) {
        showToast('Transaction cancelled by user.', 'error')
      } else if (!msg.includes('insufficient balance')) {
        showToast('Blockchain interaction failed. Please check your transaction and try again.', 'error')
      }
      throw err
    } finally {
      setIsPending(false)
    }
  }, [address, writeContractAsync, publicClient, showToast])

  // ── joinGame ────────────────────────────────────────────────────────────────
  const joinGame = useCallback(async (gameId: number, wagerAmount: number): Promise<void> => {
    if (!address) {
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

      // Check current CHESS token balance
      console.info(`${LOG_PREFIX} checking CHESS balance for ${address}`)
      const balance = await publicClient.readContract({
        address: CELO_CONTRACTS.token as `0x${string}`,
        abi: CHESS_TOKEN_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      }) as bigint

      if (balance < amount) {
        showToast(`Insufficient CHESS balance. You need ${wagerAmount} CHESS to join this match.`, 'error')
        throw new Error(`${LOG_PREFIX} joinGame: Insufficient balance`)
      }

      // Check current allowance for the game contract
      console.info(`${LOG_PREFIX} checking allowance for game contract`)
      const allowance = await publicClient.readContract({
        address: CELO_CONTRACTS.token as `0x${string}`,
        abi: CHESS_TOKEN_ABI,
        functionName: 'allowance',
        args: [address as `0x${string}`, CELO_CONTRACTS.game as `0x${string}`],
      }) as bigint

      if (allowance < amount) {
        // Step 1 — approve
        console.info(`${LOG_PREFIX} joinGame: sending approve`, { gameId, wager: wagerAmount })
        showToast('Please approve the CHESS token spending limit in your wallet...', 'info')
        const approveTxHash = await writeContractAsync({
          address: CELO_CONTRACTS.token as `0x${string}`,
          abi: CHESS_TOKEN_ABI,
          functionName: 'approve',
          args: [CELO_CONTRACTS.game as `0x${string}`, amount],
        })

        const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTxHash })
        if (approveReceipt.status !== 'success') {
          showToast('Approval transaction reverted.', 'error')
          throw new Error(`${LOG_PREFIX} joinGame: approve tx reverted (${approveTxHash})`)
        }
        console.info(`${LOG_PREFIX} joinGame: approve confirmed`, { hash: approveTxHash })
        showToast('Spending limit approved! Waiting to broadcast match join...', 'info')

        // Add sleep delay
        await sleep(1500)
      } else {
        console.info(`${LOG_PREFIX} joinGame: allowance already sufficient (${allowance} >= ${amount})`)
      }

      // Step 2 — join
      console.info(`${LOG_PREFIX} joinGame: sending joinGame`, { gameId })
      showToast('Please confirm the transaction to join this match in your wallet...', 'info')
      const joinTxHash = await writeContractAsync({
        address: CELO_CONTRACTS.game as `0x${string}`,
        abi: CHESS_GAME_ABI,
        functionName: 'joinGame',
        args: [BigInt(gameId)],
      })

      const joinReceipt = await publicClient.waitForTransactionReceipt({ hash: joinTxHash })
      if (joinReceipt.status !== 'success') {
        showToast('Match joining transaction reverted.', 'error')
        throw new Error(`${LOG_PREFIX} joinGame: joinGame tx reverted (${joinTxHash})`)
      }
      console.info(`${LOG_PREFIX} joinGame: success`, { gameId, hash: joinTxHash })
      showToast('Successfully joined the match!', 'success')
    } catch (err) {
      console.error(`${LOG_PREFIX} joinGame failed:`, err)
      const msg = (err instanceof Error ? err.message : '').toLowerCase()
      const userCancelled = msg.includes('rejected') || msg.includes('user denied') || msg.includes('cancelled')
      if (userCancelled) {
        showToast('Transaction cancelled by user.', 'error')
      } else if (!msg.includes('insufficient balance')) {
        showToast('Blockchain interaction failed. Please check your transaction and try again.', 'error')
      }
      throw err
    } finally {
      setIsPending(false)
    }
  }, [address, writeContractAsync, publicClient, showToast])

  // ── submitMove ──────────────────────────────────────────────────────────────
  const submitMove = useCallback(async (gameId: number) => {
    if (!publicClient) throw new Error(`${LOG_PREFIX} submitMove: public client unavailable`)
    console.info(`${LOG_PREFIX} submitMove`, { gameId })
    try {
      return await writeContractAsync({
        address: CELO_CONTRACTS.game as `0x${string}`,
        abi: CHESS_GAME_ABI,
        functionName: 'submitMove',
        args: [BigInt(gameId)],
      })
    } catch (err) {
      console.error(`${LOG_PREFIX} submitMove failed:`, err)
      throw err
    }
  }, [writeContractAsync, publicClient])

  // ── resign ──────────────────────────────────────────────────────────────────
  const resign = useCallback(async (gameId: number) => {
    console.info(`${LOG_PREFIX} resign`, { gameId })
    try {
      return await writeContractAsync({
        address: CELO_CONTRACTS.game as `0x${string}`,
        abi: CHESS_GAME_ABI,
        functionName: 'resign',
        args: [BigInt(gameId)],
      })
    } catch (err) {
      console.error(`${LOG_PREFIX} resign failed:`, err)
      throw err
    }
  }, [writeContractAsync])

  // ── reportWin ───────────────────────────────────────────────────────────────
  const reportWin = useCallback(async (gameId: number) => {
    console.info(`${LOG_PREFIX} reportWin`, { gameId })
    try {
      return await writeContractAsync({
        address: CELO_CONTRACTS.game as `0x${string}`,
        abi: CHESS_GAME_ABI,
        functionName: 'reportWin',
        args: [BigInt(gameId)],
      })
    } catch (err) {
      console.error(`${LOG_PREFIX} reportWin failed:`, err)
      throw err
    }
  }, [writeContractAsync])

  return { createGame, joinGame, submitMove, resign, reportWin, isPending }
}
