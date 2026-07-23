import { NextRequest, NextResponse } from 'next/server'
import { isAddress, formatUnits, type Abi } from 'viem'
import { getPublicClient } from '@/lib/celo-server'
import { syncGameIndex, getPlayerGameIds } from '@/lib/game-index'
import { CELO_CONTRACTS, TOKEN_DECIMALS } from '@/config/contracts'
import { CHESS_GAME_ABI } from '@/config/abis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GAME = CELO_CONTRACTS.game as `0x${string}`
const ZERO = '0x0000000000000000000000000000000000000000'
const STATUS_LABELS = ['Waiting', 'Active', 'Finished', 'Cancelled', 'Draw']

export type HistoryItem = {
  id: string
  chain: 'celo'
  role: 'white' | 'black'
  opponent: string
  wager: string
  status: string
  result: 'win' | 'loss' | 'draw' | 'active' | 'waiting'
  timestamp: number
  // true when an Active game has passed the expiry backstop and either
  // participant may reclaim (cancel + refund). Only meaningful while Active.
  canReclaim: boolean
}

// GET /api/history?address=0x… — a player's games, resolved via the Redis index
// (only that player's gameIds are read on-chain, not the whole game table).
/**
 * GET
 * @param {*} req: NextRequest
 * @returns {*}
 */
export async function GET(req: NextRequest) {
  const address = (req.nextUrl.searchParams.get('address') ?? '').trim()
  if (!isAddress(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 })
  }
  const me = address.toLowerCase()

  try {
    await syncGameIndex()
    const ids = await getPlayerGameIds(me)
    if (ids.length === 0) return NextResponse.json({ history: [] })

    const results = await getPublicClient().multicall({
      contracts: ids.map((id) => ({
        address: GAME,
        abi: CHESS_GAME_ABI as Abi,
        functionName: 'getGame',
        args: [BigInt(id)],
      })),
      allowFailure: true,
    })

    const items: HistoryItem[] = []
    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      if (r.status !== 'success') continue
      const g = r.result as { white: string; black: string; wager: bigint; status: number | bigint; result: number | bigint; createdAt: number | bigint }
      const white = (g.white as string).toLowerCase()
      const black = (g.black as string).toLowerCase()
      if (white !== me && black !== me) continue

      const role: 'white' | 'black' = white === me ? 'white' : 'black'
      const opponent = role === 'white' ? g.black : g.white
      const statusIdx = Number(g.status)
      const resultIdx = Number(g.result)
      let result: HistoryItem['result'] = 'active'
      if (statusIdx === 0) result = 'waiting'
      else if (statusIdx === 4 || resultIdx === 3) result = 'draw'
      else if (statusIdx === 2) {
        if (resultIdx === 1) result = role === 'white' ? 'win' : 'loss'
        else if (resultIdx === 2) result = role === 'black' ? 'win' : 'loss'
      }
      items.push({
        id: String(ids[i]),
        chain: 'celo',
        role,
        opponent: opponent.toLowerCase() === ZERO ? 'Waiting...' : opponent,
        wager: formatUnits(g.wager as bigint, TOKEN_DECIMALS),
        status: STATUS_LABELS[statusIdx] ?? 'Unknown',
        result,
        timestamp: Number(g.createdAt), // v2: unix seconds straight from the chain

        canReclaim: false,
      })
    }

    // For still-Active games, check the on-chain expiry backstop so the client
    // can offer a "Reclaim" action (the oracle can't reclaim — participants only).
    const activeItems = items.filter((it) => it.status === 'Active')
    if (activeItems.length > 0) {
      const reclaimResults = await getPublicClient().multicall({
        contracts: activeItems.map((it) => ({
          address: GAME,
          abi: CHESS_GAME_ABI as Abi,
          functionName: 'canReclaim',
          args: [BigInt(it.id)],
        })),
        allowFailure: true,
      })
      activeItems.forEach((it, i) => {
        const r = reclaimResults[i]
        if (r.status === 'success') it.canReclaim = Boolean(r.result)
      })
    }

    items.sort((a, b) => b.timestamp - a.timestamp)
    return NextResponse.json({ history: items })
  } catch (err) {
    console.error('[api/history] failed:', (err as Error)?.message)
    return NextResponse.json({ error: 'history unavailable' }, { status: 503 })
  }
}
