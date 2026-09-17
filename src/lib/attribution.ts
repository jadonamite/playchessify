// ERC-8021 attribution tags (Celo "Agents at Work" hackathon).
//
// Every leaderboard the hackathon scores on counts ONLY transactions carrying
// our tag, and the tag lives in the transaction's calldata — so it has to be
// there when the transaction is sent. There is no backfill: an untagged tx is
// permanently uncounted. That is why this is wired at the two choke points
// every write already funnels through (`useCeloChess.sendWrite` on the client,
// `celo-server.ts` on the server) rather than call site by call site.
//
// Nothing here can change what a transaction does; the suffix is trailing
// calldata the contract never reads.
import { toDataSuffix } from '@celo/attribution-tags'
import type { Hex } from 'viem'

// The tag assigned at registration, derived from the `jadonamite/playchessify`
// GitHub slug and locked permanently at first draft save.
//
// It is a literal, not an env var, and that is deliberate. This shipped as
// NEXT_PUBLIC_ATTRIBUTION_TAG first and produced zero tagged transactions for a
// full day: the value was set "Sensitive" in Vercel, which means it cannot be
// read back by anyone, so there was no way to tell a correct tag from a missing
// one — and an unset tag degrades to an ordinary untagged write, which looks
// exactly like normal operation. The tag is public (it is printed on the
// hackathon's own Dune dashboard), so there is nothing to protect and no reason
// to accept a failure mode that is invisible from the outside.
const ASSIGNED_CODE = 'celo_5d5a7df8d3aa'

// ERC-8021 codes are lowercase [a-z0-9_], max 32 chars; toDataSuffix THROWS on
// anything else. A registration code (CELO-XXXXX-…) pasted in by mistake is
// exactly that shape, so bad codes are dropped and reported rather than allowed
// to crash the app at import.
const CODE_RE = /^[a-z0-9_]{1,32}$/

// Optional extra codes. ERC-8021 lets one suffix carry several, so our own
// code can ride alongside the assigned one — but only the assigned tag is
// credited, and a typo here must never be able to take it down with it.
function envCodes(): string[] {
  const raw = process.env.NEXT_PUBLIC_ATTRIBUTION_TAG?.trim()
  if (!raw) return []

  const parsed = raw.split(',').map((c) => c.trim()).filter(Boolean)
  const bad = parsed.filter((c) => !CODE_RE.test(c))
  if (bad.length > 0) {
    console.error(
      `[attribution] dropping ${bad.map((c) => JSON.stringify(c)).join(', ')} from ` +
        `NEXT_PUBLIC_ATTRIBUTION_TAG — not an ERC-8021 code (lowercase a-z 0-9 _, max 32 chars). ` +
        `A CELO-XXXXX-… string is a registration code, not a tag. ` +
        `${ASSIGNED_CODE} is unaffected and still tags every transaction.`,
    )
  }
  return parsed.filter((c) => CODE_RE.test(c))
}

/** Every code carried in the suffix. The assigned tag is always first. */
export const ATTRIBUTION_CODES: readonly string[] = [
  ...new Set([ASSIGNED_CODE, ...envCodes()]),
]

/**
 * The calldata suffix appended to every transaction. Pass straight to viem's
 * `dataSuffix`.
 *
 * This is `undefined` only if the SDK rejects the codes outright — a state that
 * should be unreachable, since the assigned tag is a validated literal. The
 * fallback exists so a broken suffix degrades to an untagged (but working)
 * write rather than a dead app.
 */
function buildSuffix(): Hex | undefined {
  try {
    return toDataSuffix(ATTRIBUTION_CODES) as Hex
  } catch (err) {
    console.error(
      '[attribution] toDataSuffix rejected',
      ATTRIBUTION_CODES,
      '—',
      (err as Error)?.message,
      '— transactions will go out UNTAGGED and uncounted.',
    )
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
