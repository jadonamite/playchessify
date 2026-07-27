import { useReadContract } from 'wagmi'
import { CHESS_GAME_ABI } from '@/config/abis'
import { CELO_CONTRACTS, CELO_CHAIN_ID } from '@/config/contracts'
import { ZERO } from '@/components/game/types'

export interface PlayerStats {
  wins: number
  losses: number
  draws: number
  rating: number
  tier: string
}

/** Map an ELO rating onto a candy-themed ladder tier. */
export function ratingTier(rating: number): string {
  if (rating >= 2000) return 'Grandmaster'
  if (rating >= 1800) return 'Master'
  if (rating >= 1600) return 'Expert'
  if (rating >= 1400) return 'Knight'
  if (rating >= 1200) return 'Apprentice'
  return 'Novice'
}

const BASE_RATING = 1200

/**
 * Reads a single player's on-chain `playerStats` and derives the rating tier.
 * New players (never played → rating 0) fall back to the 1200 base rating,
 * matching how the lobby treats an unseeded account.
 */
export function usePlayerStats(address?: string | null): PlayerStats | null {
  const enabled = !!address && address !== ZERO && address.startsWith('0x')

  const { data } = useReadContract({
    address: CELO_CONTRACTS.game as `0x${string}`,
    abi: CHESS_GAME_ABI,
    functionName: 'playerStats',
    args: [address as `0x${string}`],
    chainId: CELO_CHAIN_ID,
    query: { enabled },
  })

  if (!data) return null

  // outputs: [wins, losses, draws, rating, gamesPlayed]
  const s = data as readonly bigint[]
  const raw = Number(s[3])
  const rating = raw > 0 ? raw : BASE_RATING

  return {
    wins: Number(s[0]),
    losses: Number(s[1]),
    draws: Number(s[2]),
    rating,
    tier: ratingTier(rating),
  }
}
