// Client-safe ERC-2771 meta-tx helpers. Imported by BOTH the browser (to build
// and sign ForwardRequests) and the server (to validate them). Keep this file
// free of any server-only imports (no private keys, no node-only deps).

import { CELO_CONTRACTS, CELO_CHAIN_ID } from '@/config/contracts'

/** EIP-712 domain of the deployed OZ ERC2771Forwarder. */
export function forwarderDomain() {
  return {
    name: 'PlaychessifyForwarder',
    version: '1',
    chainId: CELO_CHAIN_ID,
    verifyingContract: CELO_CONTRACTS.forwarder as `0x${string}`,
  } as const
}

/** EIP-712 type set for OZ's ForwardRequest struct. */
export const FORWARD_REQUEST_TYPES = {
  ForwardRequest: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'gas', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint48' },
    { name: 'data', type: 'bytes' },
  ],
} as const

/** Default per-call gas budget — covers every PlaychessifyEngine/PlaychessifyToken action. */
export const META_TX_GAS = 600_000n

/** Meta-txs are only ever player actions on our own contracts. */
export function isAllowedMetaTxTarget(to: string): boolean {
  const t = to.toLowerCase()
  return (
    t === CELO_CONTRACTS.game.toLowerCase() ||
    t === CELO_CONTRACTS.token.toLowerCase() ||
    t === CELO_CONTRACTS.rewards.toLowerCase()
  )
}

/** The message a player signs (nonce comes from forwarder.nonces(from)). */
export function buildForwardRequestMessage(p: {
  from: `0x${string}`
  to: `0x${string}`
  data: `0x${string}`
  nonce: bigint
  deadlineSecs?: number
}) {
  return {
    from: p.from,
    to: p.to,
    value: 0n,
    gas: META_TX_GAS,
    nonce: p.nonce,
    deadline: p.deadlineSecs ?? Math.floor(Date.now() / 1000) + 3600,
    data: p.data,
  } as const
}
