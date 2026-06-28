import { NextRequest, NextResponse } from 'next/server'
import { verifyMessage } from 'viem'
import { getProfileDirect, linkProfileAlias } from '@/lib/profile-store'

// POST /api/profile/link — link a Privy user's embedded EOA ↔ smart account so a
// single .chess name resolves for both. The EOA owns the smart account, so a
// signature from the EOA authorizes the link in either direction. Off-chain only:
// this touches name resolution, never transactions or the paymaster.
export async function POST(req: NextRequest) {
  let body: { eoa?: string; smart?: string; signature?: string; timestamp?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const eoa = body.eoa?.toLowerCase()
  const smart = body.smart?.toLowerCase()
  const { signature, timestamp } = body

  if (!eoa?.startsWith('0x') || !smart?.startsWith('0x')) {
    return NextResponse.json({ error: 'invalid addresses' }, { status: 400 })
  }
  if (eoa === smart) {
    return NextResponse.json({ error: 'addresses must differ' }, { status: 400 })
  }
  if (!signature || !timestamp) {
    return NextResponse.json({ error: 'signature and timestamp required' }, { status: 400 })
  }

  // Anti-replay: 5-minute window
  const ts = new Date(timestamp).getTime()
  if (isNaN(ts) || Date.now() - ts > 5 * 60 * 1000) {
    return NextResponse.json({ error: 'timestamp expired — re-sign and try again' }, { status: 400 })
  }

  // The EOA must prove control of itself. Since it owns the smart account, this
  // authorizes aliasing in either direction; an attacker can't forge it, so no
  // one can hijack another address's name.
  const message = `Chessify Identity Link\n\nEOA: ${eoa}\nSmart: ${smart}\nTimestamp: ${timestamp}`
  try {
    const valid = await verifyMessage({ address: eoa as `0x${string}`, message, signature: signature as `0x${string}` })
    if (!valid) return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  } catch {
    return NextResponse.json({ error: 'signature verification failed' }, { status: 401 })
  }

  const [pEoa, pSmart] = await Promise.all([getProfileDirect(eoa), getProfileDirect(smart)])

  // Point the address that has no profile at the one that does. The smart account
  // is canonical (it's the on-chain player), so when only the EOA has a profile we
  // still alias smart→eoa so the user's games resolve to their existing name.
  let linked: 'eoa->smart' | 'smart->eoa' | 'none' = 'none'
  if (pSmart && !pEoa) {
    await linkProfileAlias(eoa, smart)
    linked = 'eoa->smart'
  } else if (pEoa && !pSmart) {
    await linkProfileAlias(smart, eoa)
    linked = 'smart->eoa'
  }

  return NextResponse.json({ ok: true, linked })
}
