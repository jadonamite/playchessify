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
}

// GET /api/history?address=0x… — a player's games, resolved via the Redis index
// (only that player's gameIds are read on-chain, not the whole game table).
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

    const items: HistoryItem[] = results
      .filter((r) => r.status === 'success')
      .map((r) => processGameResult(me, r.result))
      .filter((item) => item !== null)

    items.sort((a, b) => b.timestamp - a.timestamp)
    return NextResponse.json({ history: items })
  } catch (err) {
    console.error('[api/history] failed:', (err as Error)?.message)
    return NextResponse.json({ error: 'history unavailable' }, { status: 503 })
  }
}

function processGameResult(me: string, game: { white: string; black: string; wager: bigint; status: number | bigint; result: number | bigint; createdAt: number | bigint }): HistoryItem | null {
  const white = (game.white as string).toLowerCase()
  const black = (game.black as string).toLowerCase()
  if (white !== me && black !== me) return null

  const role: 'white' | 'black' = white === me ? 'white' : 'black'
  const opponent = role === 'white' ? game.black : game.white
  const statusIdx = Number(game.status)
  const resultIdx = Number(game.result)
  let result: HistoryItem['result'] = 'active'
  if (statusIdx === 0) result = 'waiting'
  else if (statusIdx === 4 || resultIdx === 3) result = 'draw'
  else if (statusIdx === 2) {
    if (resultIdx === 1) result = role === 'white' ? 'win' : 'loss'
    else if (resultIdx === 2) result = role === 'black' ? 'win' : 'loss'
  }

  return {
    id: '',
    chain: 'celo',
    role,
    opponent: opponent.toLowerCase() === ZERO ? 'Waiting...' : opponent,
    wager: formatUnits(game.wager as bigint, TOKEN_DECIMALS),
    status: STATUS_LABELS[statusIdx] ?? 'Unknown',
    result,
    timestamp: Number(game.createdAt),
  }
}