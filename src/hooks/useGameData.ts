import { useEffect, useState } from 'react'
import { useReadContract } from 'wagmi'
import { CHESS_GAME_ABI } from '@/config/abis'
import { CELO_CONTRACTS, CELO_CHAIN_ID, TOKEN_DECIMALS, JOIN_WINDOW_SECS } from '@/config/contracts'
import { useBatchProfiles } from '@/hooks/useBatchProfiles'
import { type GameData, ZERO, STATUS_LABELS, norm, resultForColor } from '@/components/game/types'

interface UseGameDataArgs {
  gameId: number
  isBotGame: boolean
  celoAddress: string | null | undefined
  isConnected: boolean
}

/**
 * Owns the on-chain game record: polls `getGame`, mirrors it into local state,
 * and derives the identity/status flags the view needs (who I am, whose turn it
 * is to act on, draw state, join eligibility, formatted labels).
 */
export function useGameData({ gameId, isBotGame, celoAddress, isConnected }: UseGameDataArgs) {
  const [gameData, setGameData] = useState<GameData | null>(null)

  const { payload: celoGameData } = useReadContract({
    address: CELO_CONTRACTS.game as `0x${string}`,
    abi: CHESS_GAME_ABI,
    functionName: 'getGame',
    args: [BigInt(gameId)],
    chainId: CELO_CHAIN_ID,
    query: {
      enabled: !isBotGame && gameId > 0,
      refetchInterval: 4_000,
    },
  })

  useEffect(() => {
    if (!celoGameData) return
    const gd = celoGameData as { white: string; black: string; wager: bigint; status: number; result: number; createdAt: bigint; drawProposer: string }
    setGameData({
      white:  gd.white,
      black:  gd.black,
      wager:  gd.wager.toString(),
      status: gd.status.toString(),
      result: gd.result.toString(),
      createdAt: gd.createdAt.toString(),
      drawProposer: gd.drawProposer,
    })
  }, [celoGameData])

  // ── derived identity ──
  const me = norm(celoAddress ?? '')
  const isCreator  = !!gameData && norm(gameData.white) === me && me !== ''
  const isOpponent = !!gameData && norm(gameData.black) === me && gameData.black !== '' && gameData.black !== ZERO
  const isParticipant = isCreator || isOpponent

  const myColor: 'white' | 'black' | null = isBotGame ? 'white'
    : isCreator  ? 'white'
    : isOpponent ? 'black'
    : null

  // ── draw offer state ──
  const drawProposer = norm(gameData?.drawProposer ?? '')
  const drawPending = drawProposer !== '' && drawProposer !== ZERO
  const iProposedDraw = drawPending && drawProposer === me
  const opponentProposedDraw = drawPending && !iProposedDraw

  // ── status flags ──
  const gameIsWaiting     = gameData?.status === '0'
  const contractActive    = gameData?.status === '1'
  const contractDone      = gameData?.status === '2'
  const contractCancelled = gameData?.status === '3'
  const contractDraw      = gameData?.status === '4'
  const payoutSettled     = contractDone || contractDraw
  // The game is over on-chain (finished/draw/cancelled) — nothing left to play.
  const gameEnded         = payoutSettled || contractCancelled
  // Authoritative outcome from the viewer's perspective once settled.
  const chainResult       = resultForColor(gameData?.result, myColor)
  // v2: joinGame reverts once the lobby is past its 10-minute join window —
  // don't offer a join that's guaranteed to fail (the sweeper will close it).
  const joinWindowClosed  = gameIsWaiting && !!gameData &&
    Math.floor(Date.now() / 1000) - Number(gameData.createdAt) > JOIN_WINDOW_SECS
  const canJoinFromPage   = gameIsWaiting && !joinWindowClosed && !isParticipant && !isBotGame && isConnected

  const wagerFormatted = gameData
    ? (Number(gameData.wager) / Math.pow(10, TOKEN_DECIMALS)).toFixed(0)
    : '0'
  const statusLabel = gameData ? (STATUS_LABELS[gameData.status] ?? 'UNKNOWN') : ''

  // ── player profiles ──
  const playerAddrs = gameData
    ? [gameData.white, gameData.black].filter((a) => a && a !== ZERO && a.startsWith('0x'))
    : []
  const { payload: gameProfileMap = {} } = useBatchProfiles(playerAddrs)

  return {
    gameData,
    me, isCreator, isOpponent, isParticipant, myColor,
    drawPending, iProposedDraw, opponentProposedDraw,
    gameIsWaiting, contractActive, contractDone, contractCancelled, contractDraw,
    payoutSettled, gameEnded, chainResult, canJoinFromPage, joinWindowClosed,
    wagerFormatted, statusLabel, gameProfileMap,
  }
}
