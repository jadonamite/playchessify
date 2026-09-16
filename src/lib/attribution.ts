// ERC-8021 attribution tags (Celo "Agents at Work" hackathon).
//
// Every leaderboard the hackathon scores on counts ONLY transactions carrying
// our tag, and the tag lives in the transaction's calldata — so it has to be
// there when the transaction is sent. There is no backfill: an untagged tx is
// permanently uncounted. That is why this is wired at the two choke points
// every write already funnels through (`useCeloChess.sendWrite` on the client,
// `celo-server.ts` on the server) rather than call site by call site.
//
// Absent env var = no suffix = ordinary untagged transactions. Nothing here can
// change what a transaction does; the suffix is trailing calldata the contract
// never reads.
import { toDataSuffix } from '@celo/attribution-tags'
import type { Hex } from 'viem'

// NEXT_PUBLIC_ so the browser bundle can tag client-signed writes too. The tag
// is a public identifier printed on a public dashboard — it is not a secret.
// Comma-separated to allow our own code alongside the assigned one; the
// hackathon credits only the assigned tag but keeps the rest intact.
const RAW = process.env.NEXT_PUBLIC_ATTRIBUTION_TAG?.trim()

export const ATTRIBUTION_CODES: readonly string[] = RAW
  ? RAW.split(',').map((c) => c.trim()).filter(Boolean)
  : []

/**
 * The calldata suffix to append to every transaction, or `undefined` when no
 * tag is configured. Pass straight to viem's `dataSuffix` — viem treats
 * `undefined` as "no suffix", so an unset tag is a clean no-op.
 */
// ERC-8021 codes are lowercase [a-z0-9_], max 32 chars. toDataSuffix THROWS on
// anything else — and this module is evaluated at import, so a malformed tag
// would take down every route and page that touches a write path. A registration
// or confirmation code pasted in here by mistake is exactly that shape, so it is
// caught and reported rather than allowed to crash the app.
const CODE_RE = /^[a-z0-9_]{1,32}$/

function buildSuffix(): Hex | undefined {
  if (ATTRIBUTION_CODES.length === 0) return undefined

  const bad = ATTRIBUTION_CODES.filter((c) => !CODE_RE.test(c))
  if (bad.length > 0) {
    console.error(
      `[attribution] ignoring NEXT_PUBLIC_ATTRIBUTION_TAG — ${bad.map((c) => JSON.stringify(c)).join(', ')} ` +
        `is not an ERC-8021 code (lowercase a-z 0-9 _, max 32 chars). ` +
        `The hackathon tag looks like "celo_…"; a CELO-XXXXX-… string is a registration code, not a tag. ` +
        `Transactions will go out UNTAGGED and uncounted until this is fixed.`,
    )
    return undefined
  }

  try {
    return toDataSuffix(ATTRIBUTION_CODES) as Hex
  } catch (err) {
    console.error('[attribution] toDataSuffix rejected the configured tag:', (err as Error)?.message)
    return undefined
  }
}

export const ATTRIBUTION_SUFFIX: Hex | undefined = buildSuffix()

/**
 * Append the suffix to already-encoded calldata, for the paths that don't take
 * a `dataSuffix` option (smart-wallet `sendTransaction`, raw meta-tx encoding).
 */
export function withAttribution(data: Hex): Hex {
  return ATTRIBUTION_SUFFIX ? ((data + ATTRIBUTION_SUFFIX.slice(2)) as Hex) : data
}
