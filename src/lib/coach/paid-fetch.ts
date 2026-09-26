// The coach pays for its own analysis.
//
// Until now a coaching request was a feature: the server called a model on a
// platform key and the cost was invisible. This makes the coach an agent with
// economic agency instead — its own wallet, its own balance, settling per
// request over x402 on Celo, and stopping when the money runs out.
//
// Nothing here throws at import. An unconfigured coach agent simply reports
// "not enabled" and the caller falls back to the existing free path, exactly
// like the platform-key behaviour it replaces.
import { privateKeyToAccount } from 'viem/accounts'
import type { LocalAccount } from 'viem'
import { x402 } from '@celo/buy-core'
import { reserve, release, recordSpend, toMicro } from '@/lib/coach/budget'

/** Hard ceiling per request, independent of the coach's balance — a runaway
 *  price quote must not be able to drain a funded coach in one call. */
const MAX_PER_CALL_MICRO = toMicro(0.05)

export interface PaidResult {
  response: Response
  /** Micro-units actually committed. */
  spent: number
  /** x402 settlement reference, when the facilitator returned one. */
  ref?: string
  /** True only on a 2xx paid response — a 4xx or 5xx may still have settled. */
  confirmed?: boolean
}

export class BudgetExhausted extends Error {
  constructor(public readonly coach: string) {
    super(`[coach] ${coach} is out of budget`)
    this.name = 'BudgetExhausted'
  }
}

let _account: LocalAccount | null = null
let _resolved = false

function account(): LocalAccount | null {
  if (_resolved) return _account
  _resolved = true
  const key = process.env.COACH_AGENT_PRIVATE_KEY
  if (!key) return (_account = null)
  try {
    _account = privateKeyToAccount(key.startsWith('0x') ? (key as `0x${string}`) : `0x${key}`)
  } catch (err) {
    console.error('[coach/paid-fetch] bad COACH_AGENT_PRIVATE_KEY:', (err as Error)?.message)
    _account = null
  }
  return _account
}

/** Whether the coach can pay at all. Callers use this to choose the free path. */
export function paymentsEnabled(): boolean {
  return Boolean(account() && process.env.COACH_X402_ENDPOINT)
}

/**
 * Spend from `coach`'s balance to make one paid request.
 *
 * The reservation is taken in `onBeforePayment` — after the challenge has been
 * parsed, priced and signed, so a 402 we decline to pay never charges the
 * budget. It is released only when no paid request ever left: once the payment
 * header is on the wire even a 4xx may have settled, and refunding those would
 * drift the ledger away from the chain. Two concurrent analyses cannot both
 * spend the same last cent.
 */
export async function paidFetch(
  coach: string,
  url: string,
  init: RequestInit,
  priceMicro: number,
): Promise<PaidResult> {
  const acct = account()
  if (!acct) throw new Error('[coach/paid-fetch] no agent wallet configured')
  if (priceMicro <= 0 || priceMicro > MAX_PER_CALL_MICRO) {
    throw new Error(`[coach/paid-fetch] price out of bounds: ${priceMicro} micro`)
  }

  let reserved = false
  let ref: string | undefined
  let attempted = false
  let confirmed = false

  try {
    const response = await x402.payingFetch(
      { account: acct, network: 'celo' },
      url,
      {
        ...init,
        // Our ceiling on the challenge; the budget reservation is the other one.
        maxAmount: BigInt(priceMicro),
        onBeforePayment: async () => {
          if (!(await reserve(coach, priceMicro))) throw new BudgetExhausted(coach)
          reserved = true
        },
        onPayment: (info) => {
          attempted = true
          ref = info.txHash
          confirmed = info.outcome === 'confirmed'
        },
      },
    )

    if (!reserved) return { response, spent: 0 }

    if (!attempted) {
      await release(coach, priceMicro)
      return { response, spent: 0 }
    }

    await recordSpend(coach, { ts: Date.now(), amount: priceMicro, endpoint: url, ref })
    return { response, spent: priceMicro, ref, confirmed }
  } catch (err) {
    if (reserved && !attempted) await release(coach, priceMicro)
    throw err
  }
}
