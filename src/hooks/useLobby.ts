import { useState, useEffect, useCallback } from 'react'
import { usePublicClient } from 'wagmi'
import { formatUnits } from 'viem'
import { CHESS_GAME_ABI } from '@/config/abis'
import { CELO_CONTRACTS, JOIN_WINDOW_SECS, TOKEN_DECIMALS } from '@/config/contracts'

export interface Game {
  id: number
  creator: string
  wager: number
  chain: 'celo'
  elo: number
}

// One multicall instead of one round trip per game. The old loop awaited
// getGame serially from nonce-1 down to nonce-10 — ten blocking calls every
// 30s for every connected client, and a hard ten-game horizon. With a dozen
// bots creating lobbies, a human's open game fell out of that horizon within
// minutes and became invisible while still joinable.
const BATCH = 30
// Ids are chronological, so the scan stops at the first game older than the
// join window; MAX_SCAN only bounds the pathological case.
const MAX_SCAN = 300
const ZERO = '0x0000000000000000000000000000000000000000'

interface OnchainGame {
  white: string
  wager: bigint
  status: number | bigint
  createdAt: bigint
}

export function useLobby() {
  const publicClient = usePublicClient()
  const [games, setGames] = useState<Game[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchGames = useCallback(async () => {
    if (!publicClient) return []
    const game = CELO_CONTRACTS.game as `0x${string}`
    try {
      const nonce = (await publicClient.readContract({
        address: game,
        abi: CHESS_GAME_ABI,
        functionName: 'gameNonce',
      })) as bigint

      const result: Game[] = []
      const nowSecs = Math.floor(Date.now() / 1000)
      const cutoff = nowSecs - JOIN_WINDOW_SECS
      const newest = Number(nonce) - 1
      const floor = Math.max(0, newest - MAX_SCAN)

      for (let top = newest; top >= floor; top -= BATCH) {
        const ids: number[] = []
        for (let i = top; i > Math.max(floor - 1, top - BATCH); i--) ids.push(i)
        if (ids.length === 0) break

        const reads = await publicClient.multicall({
          contracts: ids.map((id) => ({
            address: game,
            abi: CHESS_GAME_ABI,
            functionName: 'getGame',
            args: [BigInt(id)],
          })),
          allowFailure: true,
        })

        let exhausted = false
        reads.forEach((read, idx) => {
          if (read.status !== 'success') return
          const g = read.result as unknown as OnchainGame
          if (!g) return

          const createdAt = Number(g.createdAt ?? 0)
          // Everything below this id was created earlier still — once one game
          // predates the join window, the rest of the scan is all expired.
          if (createdAt > 0 && createdAt < cutoff) {
            exhausted = true
            return
          }
          if (Number(g.status) !== 0 || g.white === ZERO || !g.white) return

          result.push({
            id: ids[idx],
            creator: g.white,
            wager: Number(formatUnits(g.wager, TOKEN_DECIMALS)),
            chain: 'celo',
            elo: 1200,
          })
        })

        if (exhausted) break
      }
      return result
    } catch (err) {
      console.error('Lobby fetch error:', err)
      return []
    }
  }, [publicClient])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    const list = await fetchGames()
    setGames(list)
    setIsLoading(false)
  }, [fetchGames])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch lobby on mount, then poll
    refresh()
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [refresh])

  return { games, isLoading, refresh }
}
