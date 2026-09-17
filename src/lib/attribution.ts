import { toDataSuffix } from '@celo/attribution-tags'
import type { Hex } from 'viem'

/** ERC-8021 code assigned at registration. Public, and fixed to this repo. */
const ASSIGNED_CODE = 'celo_5d5a7df8d3aa'

/** ERC-8021 codes are lowercase a-z 0-9 _, max 32 chars; toDataSuffix throws on anything else. */
const CODE_RE = /^[a-z0-9_]{1,32}$/

/** Optional additional codes, comma-separated. Invalid entries are dropped, not fatal. */
function extraCodes(): string[] {
  const raw = process.env.NEXT_PUBLIC_ATTRIBUTION_TAG?.trim()
  if (!raw) return []

  const parsed = raw.split(',').map((c) => c.trim()).filter(Boolean)
  const bad = parsed.filter((c) => !CODE_RE.test(c))
  if (bad.length > 0) console.error(`[attribution] ignoring invalid code(s): ${bad.join(', ')}`)

  return parsed.filter((c) => CODE_RE.test(c))
}

export const ATTRIBUTION_CODES: readonly string[] = [
  ...new Set([ASSIGNED_CODE, ...extraCodes()]),
]

function buildSuffix(): Hex | undefined {
  try {
    return toDataSuffix(ATTRIBUTION_CODES) as Hex
  } catch (err) {
    console.error('[attribution] toDataSuffix failed:', (err as Error)?.message)
    return undefined
  }
}

/** Trailing calldata for viem's `dataSuffix`. Contracts never read it. */
export const ATTRIBUTION_SUFFIX: Hex | undefined = buildSuffix()

/** For write paths with no `dataSuffix` option: smart-wallet sendTransaction, meta-tx encoding. */
export function withAttribution(data: Hex): Hex {
  return ATTRIBUTION_SUFFIX ? ((data + ATTRIBUTION_SUFFIX.slice(2)) as Hex) : data
}
