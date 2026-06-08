import { NextRequest, NextResponse } from 'next/server'
import { Chess } from 'chess.js'
import { Redis } from '@upstash/redis'
import { getMoves, type Chain } from '@/lib/moves-store'
import {
  getOnchainGame,
  settleOnChain,
  GameResult,
  GameStatus,
} from '@/lib/celo-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOG_PREFIX = '[api/settle]'

// A side that hasn't moved within this window after the opponent's last move
// forfeits on time. Mirrors the in-game 5-minute move clock.
const MOVE_TIMEOUT_MS = 5 * 60 * 1000

// ── Redis settle-lock (dedupe concurrent settlements) ────────────────────────
let _redis: Redis | null = null
function getRedis(): Redis {
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error(`${LOG_PREFIX} Missing Upstash env vars`)
  _redis = new Redis({ url, token })
  return _redis
}

function parseChain(value: string): Chain | null {
  return value === 'celo' ? value : null
}

function parseGameId(value: string): number | null {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) return null
  return n
}

type Terminal =
  | { kind: 'result'; result: GameResult }
  | { kind: 'not-terminal' }

// Replay the authoritative move list and decide the result. NEVER trusts the
// client — the SAN list from the relay is replayed move-by-move with chess.js,
// and an illegal sequence is rejected.
function deriveResult(
  moves: { san: string; player: string; ts: number }[],
  white: string,
  black: string,
): Terminal | { kind: 'illegal' } {
  const chess = new Chess()
  for (const m of moves) {
    try {
      const applied = chess.move(m.san)
      if (!applied) return { kind: 'illegal' }
    } catch {
      return { kind: 'illegal' }
    }
  }

  // Checkmate: the side to move is mated → opponent wins.
  if (chess.isCheckmate()) {
    const loserIsWhite = chess.turn() === 'w'
    return {
      kind: 'result',
      result: loserIsWhite ? GameResult.BlackWins : GameResult.WhiteWins,
    }
  }

  // Any drawn terminal position (stalemate, insufficient material, 3-fold, 50-move).
  if (chess.isStalemate() || chess.isInsufficientMaterial() || chess.isDraw()) {
    return { kind: 'result', result: GameResult.DrawResult }
  }

  // Not terminal by board — check the move clock for a timeout forfeit.
  if (moves.length > 0) {
    const last = moves[moves.length - 1]
    if (Date.now() - last.ts > MOVE_TIMEOUT_MS) {
      // Side to move has run out of time → the player who made the last move wins.
      const sideToMoveIsWhite = chess.turn() === 'w'
      const winnerIsWhite = !sideToMoveIsWhite
      // Cross-check: the last mover should be the winner's address.
      const winnerAddr = winnerIsWhite ? white : black
      if (last.player.toLowerCase() === winnerAddr.toLowerCase()) {
        return {
          kind: 'result',
          result: winnerIsWhite ? GameResult.WhiteWins : GameResult.BlackWins,
        }
      }
    }
  }

  return { kind: 'not-terminal' }
}

// POST /api/games/:chain/:id/settle — replay the game and settle it on-chain.
// Idempotent: the contract reverts on a non-Active game, and a Redis lock
// prevents two concurrent settlements from racing.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ chain: string; id: string }> },
) {
  const { chain: chainRaw, id: idRaw } = await params
  const chain = parseChain(chainRaw)
  const gameId = parseGameId(idRaw)

  if (!chain) return NextResponse.json({ error: 'invalid chain' }, { status: 400 })
  if (gameId === null) return NextResponse.json({ error: 'invalid gameId' }, { status: 400 })

  try {
    // 1. Replay moves from the relay.
    const moves = await getMoves(chain, gameId)

    // 2. Read on-chain game; require it to be settleable.
    const game = await getOnchainGame(gameId)
    if (game.status !== GameStatus.Active) {
      return NextResponse.json(
        { error: 'game not active', status: game.status },
        { status: 409 },
      )
    }

    // 3. Derive the result by replaying with chess.js.
    const derived = deriveResult(moves, game.white, game.black)
    if (derived.kind === 'illegal') {
      return NextResponse.json({ error: 'illegal move sequence' }, { status: 422 })
    }
    if (derived.kind === 'not-terminal') {
      return NextResponse.json({ error: 'game not terminal' }, { status: 400 })
    }

    // 4. Dedupe lock — only one settlement may proceed per game.
    const lockKey = `chess:settle:${chain}:${gameId}`
    const acquired = await getRedis().set(lockKey, '1', { nx: true, ex: 120 })
    if (acquired !== 'OK') {
      return NextResponse.json({ error: 'settlement in progress' }, { status: 409 })
    }

    // 5. Settle on-chain.
    try {
      const txHash = await settleOnChain(gameId, derived.result)
      return NextResponse.json({ ok: true, txHash, result: derived.result })
    } catch (err) {
      // Release the lock on failure so a retry can proceed.
      await getRedis().del(lockKey)
      throw err
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} POST failed`, {
      chain,
      gameId,
      err: (err as Error)?.message,
    })
    return NextResponse.json({ error: 'settlement failed' }, { status: 503 })
  }
}
