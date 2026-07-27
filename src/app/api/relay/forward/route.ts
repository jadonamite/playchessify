import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import {
  verifyForwardRequest,
  executeForwardRequest,
  type ForwardRequestData,
  type Address,
} from '@/lib/celo-server'
import { isAllowedMetaTxTarget, META_TX_GAS } from '@/lib/meta-tx'

export const runtime = 'nodejs'

const LOG_PREFIX = '[api/relay/forward]'

// POST /api/relay/forward — execute a player-signed ERC-2771 ForwardRequest.
//
// This is the Tier C gasless rail: an external EOA (MetaMask etc.) with zero
// CELO signs an EIP-712 ForwardRequest in-wallet; the gas-sponsor wallet
// executes it here and pays the gas. Safety comes from the forwarder itself —
// it verifies the player's signature, nonce, and deadline on-chain, so this
// route can never act on a player's behalf; it can only pay for what the
// player already signed. Our own checks are purely anti-drain: allowed targets,
// zero value, a gas cap, and per-address + daily rate limits (same shape as the
// gas-drip guards in /api/gas/sponsor).

const COOLDOWN_S = 3           // per-address gap between meta-txs
const DAILY_PER_ADDRESS = 200  // generous — a long game is ~1 tx (settle is oracle-paid)
const DAILY_GLOBAL = 5_000

const K = {
  cooldown: (a: string) => `chess:v2:fwd:cooldown:${a.toLowerCase()}`,
  daily: (a: string) => `chess:v2:fwd:daily:${a.toLowerCase()}:${new Date().toISOString().slice(0, 10)}`,
  global: () => `chess:v2:fwd:global:${new Date().toISOString().slice(0, 10)}`,
}

let _redis: Redis | null = null
function getRedis(): Redis | null {
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  _redis = new Redis({ url, token })
  return _redis
}

const HEX = /^0x[a-fA-F0-9]*$/
const ADDR = /^0x[a-fA-F0-9]{40}$/

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }

  const from = typeof body.from === 'string' ? body.from : ''
  const to = typeof body.to === 'string' ? body.to : ''
  const data = typeof body.data === 'string' ? body.data : ''
  const signature = typeof body.signature === 'string' ? body.signature : ''
  const deadline = Number(body.deadline)

  if (!ADDR.test(from) || !ADDR.test(to)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 })
  }
  if (!HEX.test(data) || data.length < 10 || data.length > 4096) {
    return NextResponse.json({ error: 'invalid calldata' }, { status: 400 })
  }
  if (!HEX.test(signature) || signature.length !== 132) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }
  if (!Number.isInteger(deadline) || deadline <= Math.floor(Date.now() / 1000)) {
    return NextResponse.json({ error: 'expired deadline' }, { status: 400 })
  }
  if (!isAllowedMetaTxTarget(to)) {
    return NextResponse.json({ error: 'target not allowed' }, { status: 403 })
  }

  // ── Anti-drain rate limits ──
  const redis = getRedis()
  if (redis) {
    const onCooldown = await redis.set(K.cooldown(from), '1', { nx: true, ex: COOLDOWN_S })
    if (onCooldown !== 'OK') {
      return NextResponse.json({ error: 'too many requests — slow down' }, { status: 429 })
    }
    const [mine, all] = await Promise.all([redis.incr(K.daily(from)), redis.incr(K.global())])
    if (mine === 1) await redis.expire(K.daily(from), 86_400)
    if (all === 1) await redis.expire(K.global(), 86_400)
    if (mine > DAILY_PER_ADDRESS || all > DAILY_GLOBAL) {
      return NextResponse.json({ error: 'daily relay limit reached' }, { status: 429 })
    }
  }

  const request: ForwardRequestData = {
    from: from as Address,
    to: to as Address,
    value: 0n,
    gas: META_TX_GAS,
    deadline,
    data: data as `0x${string}`,
    signature: signature as `0x${string}`,
  }

  try {
    // Free preflight: the forwarder itself checks signature + nonce + deadline.
    if (!(await verifyForwardRequest(request))) {
      return NextResponse.json({ error: 'forwarder rejected request' }, { status: 401 })
    }
    const txHash = await executeForwardRequest(request)
    return NextResponse.json({ ok: true, txHash })
  } catch (err) {
    console.error(`${LOG_PREFIX} execution failed`, { from, to, err: (err as Error)?.message })
    return NextResponse.json({ error: 'relay execution failed' }, { status: 502 })
  }
}
