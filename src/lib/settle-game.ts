import { Chess } from 'chess.js'
import { Redis } from '@upstash/redis'
import { getMoves, unregisterActiveGame, type Chain, type MoveRecord } from '@/lib/moves-store'
import { deriveResult, canonicalMoveMessage } from '@/lib/settlement'
import {
  getOnchainGame,
  settleOnChain,
  verifyWalletSignature,
  GameStatus,
  GameResult,
  type Address,
} from '@/lib/celo-server'
import { recordPlayDay } from '@/lib/streak-store'

const LOG_PREFIX = '[settle-game]'

let _redis: Redis | null = null
function getRedis(): Redis {
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error(`${LOG_PREFIX} Missing Upstash env vars`)
  _redis = new Redis({ url, token })
  return _redis
}

export type SettleOutcome =
  | { ok: true; txHash: string; result: GameResult }
  | { ok: false; reason: 'not-active' | 'not-terminal' | 'illegal' | 'forged-signature' | 'in-progress'; status?: number }

/**
 * Re-verify every *signed* move during settlement. A move that carries a
 * signature must verify against its `player`; if any fails, the history has been
 * tampered with and we refuse to settle. Unsigned moves (MiniPay) are allowed
 * through — they're already bound to the side-to-move by the relay on write.
 */
async function signedMovesValid(chain: Chain, gameId: number, moves: MoveRecord[]): Promise<boolean> {
  const replay = new Chess()
  for (const m of moves) {
    let fen: string
    try {
      if (!replay.move(m.san)) return false
      fen = replay.fen()
    } catch {
      return false
    }
    if (m.sig && m.signer) {
      const message = canonicalMoveMessage({ chain, gameId, moveNumber: m.moveNumber, san: m.san, fen })
      const ok = await verifyWalletSignature(m.signer as Address, message, m.sig as `0x${string}`)
      if (!ok || m.signer.toLowerCase() !== m.player.toLowerCase()) return false
    }
  }
  return true
}

/**
 * Replay a game and settle it on-chain via the oracle. Shared by the manual
 * settle route (client-triggered) and the cron worker (guaranteed settlement).
 * Idempotent: a non-Active game is a no-op, and a Redis lock prevents two
 * settlements racing.
 */
export async function settleGameById(chain: Chain, gameId: number): Promise<SettleOutcome> {
  const moves = await getMoves(chain, gameId)

  const game = await getOnchainGame(gameId)
  if (game.status !== GameStatus.Active) {
    await unregisterActiveGame(chain, gameId)
    return { ok: false, reason: 'not-active', status: game.status }
  }

  if (!(await signedMovesValid(chain, gameId, moves))) {
    return { ok: false, reason: 'forged-signature' }
  }

  const derived = deriveResult(moves, game.white, game.black)
  if (derived.kind === 'illegal') return { ok: false, reason: 'illegal' }
  if (derived.kind === 'not-terminal') return { ok: false, reason: 'not-terminal' }

  const lockKey = `chess:v2:settle:${chain}:${gameId}`
  const acquired = await getRedis().set(lockKey, '1', { nx: true, ex: 120 })
  if (acquired !== 'OK') return { ok: false, reason: 'in-progress' }

  try {
    const txHash = await settleOnChain(gameId, derived.result as GameResult)
    await unregisterActiveGame(chain, gameId)
    // Credit both players' daily streaks — server-authoritative, so this source
    // can never be spoofed. Never let a streak hiccup undo a settled game.
    try {
      await Promise.allSettled([
        recordPlayDay(game.white),
        recordPlayDay(game.black),
      ])
    } catch (streakErr) {
      console.error(`${LOG_PREFIX} streak update failed (non-fatal)`, streakErr)
    }
    return { ok: true, txHash, result: derived.result as GameResult }
  } catch (err) {
    await getRedis().del(lockKey)
    throw err
  }
}
