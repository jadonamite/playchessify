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
import { createWalletClient, http, type WalletClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo } from 'viem/chains'
import { wrapFetchWithPayment, decodeXPaymentResponse } from 'x402-fetch'
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
}

export class BudgetExhausted extends Error {
  constructor(public readonly coach: string) {
    super(`[coach] ${coach} is out of budget`)
    this.name = 'BudgetExhausted'
  }
}

let _wallet: WalletClient | null = null
let _resolved = false

function wallet(): WalletClient | null {
  if (_resolved) return _wallet
  _resolved = true
  const key = process.env.COACH_AGENT_PRIVATE_KEY
  if (!key) return (_wallet = null)
  try {
    _wallet = createWalletClient({
      account: privateKeyToAccount(key.startsWith('0x') ? (key as `0x${string}`) : `0x${key}`),
      chain: celo,
      transport: http(process.env.CELO_RPC_URL || 'https://forno.celo.org'),
    })
  } catch (err) {
    console.error('[coach/paid-fetch] bad COACH_AGENT_PRIVATE_KEY:', (err as Error)?.message)
    _wallet = null
  }
  return _wallet
}

/** Whether the coach can pay at all. Callers use this to choose the free path. */
export function paymentsEnabled(): boolean {
  return Boolean(wallet() && process.env.COACH_X402_ENDPOINT)
}

/**
 * Spend from `coach`'s balance to make one paid request.
 *
 * The reservation is taken BEFORE the call and released if it never settles, so
 * a request that fails mid-flight cannot leave the coach silently poorer — and
 * two concurrent analyses cannot both spend the same last cent.
 */
export async function paidFetch(
  coach: string,
  url: string,
  init: RequestInit,
  priceMicro: number,
): Promise<PaidResult> {
  const w = wallet()
  if (!w) throw new Error('[coach/paid-fetch] no agent wallet configured')
  if (priceMicro <= 0 || priceMicro > MAX_PER_CALL_MICRO) {
    throw new Error(`[coach/paid-fetch] price out of bounds: ${priceMicro} micro`)
  }

  if (!(await reserve(coach, priceMicro))) throw new BudgetExhausted(coach)

  try {
    // maxValue is x402's own ceiling on what it will agree to pay for this
    // request; ours is the reservation. Both are enforced.
    const fetchWithPay = wrapFetchWithPayment(fetch, w as never, BigInt(priceMicro))
    const response = await fetchWithPay(url, init)

    if (!response.ok) {
      await release(coach, priceMicro)
      return { response, spent: 0 }
    }

    let ref: string | undefined
    try {
      const header = response.headers.get('x-payment-response')
      if (header) ref = decodeXPaymentResponse(header)?.transaction
    } catch {
      // A settled payment with an undecodable receipt is still a settled
      // payment — losing the reference must not undo the spend.
    }

    await recordSpend(coach, { ts: Date.now(), amount: priceMicro, endpoint: url, ref })
    return { response, spent: priceMicro, ref }
  } catch (err) {
    await release(coach, priceMicro)
    throw err
  }
}
