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
export const ATTRIBUTION_SUFFIX: Hex | undefined =
  ATTRIBUTION_CODES.length > 0 ? (toDataSuffix(ATTRIBUTION_CODES) as Hex) : undefined

/**
 * Append the suffix to already-encoded calldata, for the paths that don't take
 * a `dataSuffix` option (smart-wallet `sendTransaction`, raw meta-tx encoding).
 */
export function withAttribution(data: Hex): Hex {
  return ATTRIBUTION_SUFFIX ? ((data + ATTRIBUTION_SUFFIX.slice(2)) as Hex) : data
}
