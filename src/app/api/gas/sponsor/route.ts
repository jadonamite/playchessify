import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { isAddress, getAddress, type Address } from 'viem'
import {
  cusdBalanceOf,
  chessBalanceOf,
  sponsorGas,
  mintChessTo,
} from '@/lib/celo-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOG_PREFIX = '[api/gas/sponsor]'

// ── Drip economics (cUSD has 18 decimals; CHESS has 6) ───────────────────────
// A MiniPay wallet only needs enough cUSD to pay gas for approve + create/join.
const MIN_GAS_CUSD = 10_000_000_000_000_000n   // 0.01 cUSD — above this, no drip needed
const GAS_DRIP_CUSD = 30_000_000_000_000_000n  // 0.03 cUSD — covers approve + create/join
const MIN_CHESS = 100_000_000n                 // 100 CHESS — below this we provision
const CHESS_PROVISION = 1_000_000_000n         // 1,000 CHESS minted to fresh wallets

// ── Sybil guards ─────────────────────────────────────────────────────────────
const COOLDOWN_SECONDS = 60 * 60        // one funded drip per address per hour
const LOCK_SECONDS = 60                 // one in-flight drip per address
const DAILY_CAP = 1000                  // global drips per day (abuse ceiling)

let _redis: Redis | null = null
function getRedis(): Redis {
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error(`${LOG_PREFIX} Missing Upstash env vars`)
  _redis = new Redis({ url, token })
  return _redis
}

const K = {
  cooldown: (a: string) => `chess:gas:cooldown:${a.toLowerCase()}`,
  lock: (a: string) => `chess:gas:lock:${a.toLowerCase()}`,
  daily: () => `chess:gas:daily:${new Date().toISOString().slice(0, 10)}`,
}

// POST /api/gas/sponsor — Tier B (MiniPay) only.
// Makes a 0-balance MiniPay EOA able to transact: provisions CHESS + drips cUSD gas.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }

  const addressRaw = typeof body?.address === 'string' ? body.address.trim() : ''
  const chain = typeof body?.chain === 'string' ? body.chain : ''

  if (chain !== 'celo') {
    return NextResponse.json({ error: 'invalid chain' }, { status: 400 })
  }
  if (!isAddress(addressRaw)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 })
  }
  const address = getAddress(addressRaw) as Address

  const redis = getRedis()

  try {
    // Fast path: already has enough gas → nothing to do.
    const cusd = await cusdBalanceOf(address)
    if (cusd >= MIN_GAS_CUSD) {
      // Still top up CHESS if the wallet is empty, so they never call the gas-charging faucet.
      const chess = await chessBalanceOf(address)
      if (chess < MIN_CHESS) {
        const mintTx = await mintChessTo(address, CHESS_PROVISION)
        return NextResponse.json({ ok: true, skippedGas: true, mintTx })
      }
      return NextResponse.json({ ok: true, skipped: true })
    }

    // ── Sybil guards ──
    // Per-address cooldown (set after a successful drip).
    if (await redis.get(K.cooldown(address))) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'cooldown' })
    }
    // One in-flight drip per address.
    const lock = await redis.set(K.lock(address), '1', { nx: true, ex: LOCK_SECONDS })
    if (lock !== 'OK') {
      return NextResponse.json({ error: 'drip in progress' }, { status: 409 })
    }
    // Global daily cap.
    const dailyKey = K.daily()
    const count = await redis.incr(dailyKey)
    if (count === 1) await redis.expire(dailyKey, 86_400)
    if (count > DAILY_CAP) {
      await redis.del(K.lock(address))
      return NextResponse.json({ error: 'daily sponsor cap reached' }, { status: 429 })
    }

    try {
      // Provision CHESS if needed (so they never spend gas on faucetClaim).
      let mintTx: string | undefined
      const chess = await chessBalanceOf(address)
      if (chess < MIN_CHESS) {
        mintTx = await mintChessTo(address, CHESS_PROVISION)
      }

      // Drip cUSD gas.
      const gasTx = await sponsorGas(address, GAS_DRIP_CUSD)

      // Mark cooldown only on success.
      await redis.set(K.cooldown(address), '1', { ex: COOLDOWN_SECONDS })
      return NextResponse.json({ ok: true, gasTx, mintTx })
    } finally {
      await redis.del(K.lock(address))
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} POST failed`, {
      address,
      err: (err as Error)?.message,
    })
    return NextResponse.json({ error: 'sponsor failed' }, { status: 503 })
  }
}
