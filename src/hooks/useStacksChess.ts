'use client'

import { useWallet } from '@/components/wallet-provider'
import { useCallback } from 'react'
  AnchorMode,
  PostConditionMode,
  uintCV,
  Pc,
  fetchCallReadOnlyFunction,
  cvToJSON,
} from '@stacks/transactions'
import {
import { STACKS_CONTRACTS, TOKEN_DECIMALS } from '@/config/contracts'

const LOG_PREFIX = '[useStacksChess]'

// Read get-total-games directly — used to predict the next game ID before the
// wallet popup fires, since openContractCall doesn't return contract output.
async function fetchTotalGames(senderAddress: string): Promise<number> {
  try {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: STACKS_CONTRACTS.game.address,
      contractName: STACKS_CONTRACTS.game.name,
      functionName: 'get-total-games',
      functionArgs: [],
      senderAddress,
    })
    const json = cvToJSON(result)
    return Number(json.value.value)
  } catch (err) {
    console.error(`${LOG_PREFIX} fetchTotalGames failed:`, err)
    return 0
  }
}

export function useStacksChess() {
  const { stacksAddress, isStacksConnected, userSession } = useWallet()

  // ── createGame ──────────────────────────────────────────────────────────────
  // Predicts the new game ID via get-total-games before opening the wallet popup,
  // then returns { txId, gameId } so the caller can navigate immediately.
  const createGame = useCallback(async (wagerAmount: number): Promise<{ txId: string; gameId: number }> => {
    if (!isStacksConnected || !stacksAddress || !userSession) {
      throw new Error(`${LOG_PREFIX} createGame: Stacks wallet not connected`)
    }

    const { openContractCall } = await import('@stacks/connect')
    const microWager = BigInt(Math.floor(wagerAmount * Math.pow(10, TOKEN_DECIMALS)))

    // Pre-fetch total games to predict the ID the contract will assign
    console.info(`${LOG_PREFIX} createGame: fetching current game count`)
    const currentTotal = await fetchTotalGames(stacksAddress)
    const predictedGameId = currentTotal + 1
    console.info(`${LOG_PREFIX} createGame: predicted gameId = ${predictedGameId}`, { wager: wagerAmount })

    const postCondition = Pc.principal(stacksAddress)
      .willSendEq(microWager)
      .ft(`${STACKS_CONTRACTS.token.address}.${STACKS_CONTRACTS.token.name}`, 'chess-token')

    return new Promise((resolve, reject) => {
      openContractCall({
        contractAddress: STACKS_CONTRACTS.game.address,
        contractName: STACKS_CONTRACTS.game.name,
        functionName: 'create-game',
        functionArgs: [uintCV(microWager)],
        anchorMode: AnchorMode.Any,
        postConditions: [postCondition],
        postConditionMode: PostConditionMode.Deny,
        onFinish: (data) => {
          console.info(`${LOG_PREFIX} createGame: tx broadcast`, { txId: data.txId, gameId: predictedGameId })
          resolve({ txId: data.txId, gameId: predictedGameId })
        },
        onCancel: () => {
          console.warn(`${LOG_PREFIX} createGame: user cancelled wallet popup`)
          reject(new Error('Transaction cancelled'))
        },
        userSession,
      })
    })
  }, [isStacksConnected, stacksAddress, userSession])

  // ── joinGame ────────────────────────────────────────────────────────────────
  const joinGame = useCallback(async (gameId: number, wagerAmount: number): Promise<{ txId: string }> => {
    if (!isStacksConnected || !stacksAddress || !userSession) {
      throw new Error(`${LOG_PREFIX} joinGame: Stacks wallet not connected`)
    }

    const { openContractCall } = await import('@stacks/connect')
    const microWager = BigInt(Math.floor(wagerAmount * Math.pow(10, TOKEN_DECIMALS)))

    console.info(`${LOG_PREFIX} joinGame: opening wallet popup`, { gameId, wager: wagerAmount })

    const postCondition = Pc.principal(stacksAddress)
      .willSendEq(microWager)
      .ft(`${STACKS_CONTRACTS.token.address}.${STACKS_CONTRACTS.token.name}`, 'chess-token')

    return new Promise((resolve, reject) => {
      openContractCall({
        contractAddress: STACKS_CONTRACTS.game.address,
        contractName: STACKS_CONTRACTS.game.name,
        functionName: 'join-game',
        functionArgs: [uintCV(gameId)],
        anchorMode: AnchorMode.Any,
        postConditions: [postCondition],
        postConditionMode: PostConditionMode.Deny,
        onFinish: (data) => {
          console.info(`${LOG_PREFIX} joinGame: tx broadcast`, { txId: data.txId, gameId })
          resolve({ txId: data.txId })
        },
        onCancel: () => {
          console.warn(`${LOG_PREFIX} joinGame: user cancelled wallet popup`)
          reject(new Error('Transaction cancelled'))
        },
        userSession,
      })
    })
  }, [isStacksConnected, stacksAddress, userSession])

  // ── submitMove ──────────────────────────────────────────────────────────────
  const submitMove = useCallback(async (gameId: number) => {
    if (!isStacksConnected || !userSession) {
      throw new Error(`${LOG_PREFIX} submitMove: Stacks wallet not connected`)
    }
    const { openContractCall } = await import('@stacks/connect')
    console.info(`${LOG_PREFIX} submitMove`, { gameId })

    return new Promise((resolve, reject) => {
      openContractCall({
        contractAddress: STACKS_CONTRACTS.game.address,
        contractName: STACKS_CONTRACTS.game.name,
        functionName: 'submit-move',
        functionArgs: [uintCV(gameId)],
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => resolve(data),
        onCancel: () => {
          console.warn(`${LOG_PREFIX} submitMove: user cancelled`)
          reject(new Error('Transaction cancelled'))
        },
        userSession,
      })
    })
  }, [isStacksConnected, userSession])

  // ── resign ──────────────────────────────────────────────────────────────────
  const resign = useCallback(async (gameId: number) => {
    if (!isStacksConnected || !userSession) {
      throw new Error(`${LOG_PREFIX} resign: Stacks wallet not connected`)
    }
    const { openContractCall } = await import('@stacks/connect')
    console.info(`${LOG_PREFIX} resign`, { gameId })

    return new Promise((resolve, reject) => {
      openContractCall({
        contractAddress: STACKS_CONTRACTS.game.address,
        contractName: STACKS_CONTRACTS.game.name,
        functionName: 'resign',
        functionArgs: [uintCV(gameId)],
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => resolve(data),
        onCancel: () => {
          console.warn(`${LOG_PREFIX} resign: user cancelled`)
          reject(new Error('Transaction cancelled'))
        },
        userSession,
      })
    })
  }, [isStacksConnected, userSession])

  // ── reportWin ───────────────────────────────────────────────────────────────
  const reportWin = useCallback(async (gameId: number) => {
    if (!isStacksConnected || !userSession) {
      throw new Error(`${LOG_PREFIX} reportWin: Stacks wallet not connected`)
    }
    const { openContractCall } = await import('@stacks/connect')
    console.info(`${LOG_PREFIX} reportWin`, { gameId })

    return new Promise((resolve, reject) => {
      openContractCall({
        contractAddress: STACKS_CONTRACTS.game.address,
        contractName: STACKS_CONTRACTS.game.name,
        functionName: 'report-win',
        functionArgs: [uintCV(gameId)],
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => resolve(data),
        onCancel: () => {
          console.warn(`${LOG_PREFIX} reportWin: user cancelled`)
          reject(new Error('Transaction cancelled'))
        },
        userSession,
      })
    })
  }, [isStacksConnected, userSession])

  return { createGame, joinGame, submitMove, resign, reportWin }
}
