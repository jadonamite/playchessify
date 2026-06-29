import { NextRequest, NextResponse } from 'next/server'
import { Chess } from 'chess.js'
import {
  appendMove,
  getMoves,
  registerActiveGame,
  type Chain,
  type MoveRecord,
} from '@/lib/moves-store'
import {
  getOnchainGameCached,
  verifyWalletSignature,
  GameStatus,
  type Address,
} from '@/lib/celo-server'
import { canonicalMoveMessage, MOVE_TIMEOUT_MS } from '@/lib/settlement'

export const runtime = 'nodejs'

const LOG_PREFIX = '[api/moves]'

function parseChain(value: string): Chain | null {
  return value === 'celo' ? value : null
}

function parseGameId(value: string): number | null {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) return null
  return n
}

// GET /api/games/:chain/:id/moves — fetch the full move history
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ chain: string; id: string }> }
) {
  const { chain: chainRaw, id: idRaw } = await params
  const chain = parseChain(chainRaw)
  const gameId = parseGameId(idRaw)

  if (!chain) return NextResponse.json({ error: 'invalid chain' }, { status: 400 })
  if (gameId === null) return NextResponse.json({ error: 'invalid gameId' }, { status: 400 })

  try {
    const moves = await getMoves(chain, gameId)
    return NextResponse.json({ moves })
  } catch (err) {
    console.error(`${LOG_PREFIX} GET failed`, { chain, gameId, err: (err as Error)?.message })
    return NextResponse.json({ error: 'relay unavailable' }, { status: 503 })
  }
}

// POST /api/games/:chain/:id/moves — append a move
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chain: string; id: string }> }
) {
  const { chain: chainRaw, id: idRaw } = await params
  const chain = parseChain(chainRaw)
  const gameId = parseGameId(idRaw)

  if (!chain) return NextResponse.json({ error: 'invalid chain' }, { status: 400 })
  if (gameId === null) return NextResponse.json({ error: 'invalid gameId' }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }

  const san = typeof body?.san === 'string' ? body.san.trim() : ''
  const player = typeof body?.player === 'string' ? body.player.trim() : ''
  const moveNumber = Number(body?.moveNumber)
  const sig = typeof body?.sig === 'string' ? body.sig.trim() : ''

  if (!san || san.length > 16) {
    return NextResponse.json({ error: 'invalid san' }, { status: 400 })
  }
  if (!player || !/^0x[a-fA-F0-9]{40}$/.test(player)) {
    return NextResponse.json({ error: 'invalid player' }, { status: 400 })
  }
  if (!Number.isInteger(moveNumber) || moveNumber <= 0) {
    return NextResponse.json({ error: 'invalid moveNumber' }, { status: 400 })
  }

  try {
    // Race-protect: only accept this move if it lands at the expected position.
    // Two simultaneous POSTs both targeting moveNumber N: one wins, one is rejected.
    const existing = await getMoves(chain, gameId)
    if (existing.length >= moveNumber) {
      return NextResponse.json(
        { error: 'move number already recorded', moves: existing },
        { status: 409 }
      )
    }

    // ── Authenticate the move against on-chain truth ──
    // The relay is the input the settlement oracle trusts, so it must not accept
    // arbitrary writes. Bind every move to the real on-chain participants and to
    // the side whose turn it actually is.
    const game = await getOnchainGameCached(gameId)
    if (game.status !== GameStatus.Active) {
      return NextResponse.json({ error: 'game not active' }, { status: 409 })
    }

    // Move-clock enforcement: once the side to move has exceeded the timeout, the
    // game is decided (the other player wins on time) and settlement is pending.
    // Refuse the late move so a returning opponent can't sneak back in and undo the
    // result during the window before on-chain settlement lands. Measured against
    // the last recorded move's server timestamp, so both sides see one clock.
    if (existing.length > 0) {
      const last = existing[existing.length - 1]
      if (Date.now() - last.ts > MOVE_TIMEOUT_MS) {
        return NextResponse.json({ error: 'move window expired — game is being settled' }, { status: 409 })
      }
    }

    // Replay known moves to derive the legal board + whose turn it is.
    const board = new Chess()
    for (const m of existing) {
      try {
        if (!board.move(m.san)) throw new Error('bad history')
      } catch {
        return NextResponse.json({ error: 'corrupt history' }, { status: 500 })
      }
    }
    const sideToMove = board.turn() === 'w' ? game.white : game.black
    if (player.toLowerCase() !== sideToMove.toLowerCase()) {
      return NextResponse.json({ error: 'not your turn' }, { status: 403 })
    }

    // The move itself must be legal from the current position.
    let fen: string
    try {
      if (!board.move(san)) throw new Error('illegal')
      fen = board.fen()
    } catch {
      return NextResponse.json({ error: 'illegal move' }, { status: 422 })
    }

    // Cryptographically verify the signature when present (Tier A/C). MiniPay can't
    // sign, so unsigned moves are accepted on the strength of the turn binding above.
    let signer: string | undefined
    if (sig) {
      const message = canonicalMoveMessage({ chain, gameId, moveNumber, san, fen })
      const valid = await verifyWalletSignature(player as Address, message, sig as `0x${string}`)
      if (!valid) {
        return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
      }
      signer = player
    }

    const record: MoveRecord = { san, player, moveNumber, ts: Date.now(), ...(sig ? { sig, signer } : {}) }
    // Atomic, conditional on the history still being `existing.length` long.
    // If we lost a race to another writer for this slot, the move we validated is
    // no longer legal at the new tip — reject and let the client resync rather
    // than corrupting the history with an out-of-turn move.
    const newLen = await appendMove(chain, gameId, record, existing.length)
    if (newLen === null) {
      return NextResponse.json(
        { error: 'move conflict — resync', moves: await getMoves(chain, gameId) },
        { status: 409 }
      )
    }
    // Register so the settlement worker will finalize this game even if both
    // clients disappear at the terminal position.
    await registerActiveGame(chain, gameId)
    return NextResponse.json({ ok: true, moveCount: newLen, move: record })
  } catch (err) {
    console.error(`${LOG_PREFIX} POST failed`, { chain, gameId, err: (err as Error)?.message })
    return NextResponse.json({ error: 'relay unavailable' }, { status: 503 })
  }
}
