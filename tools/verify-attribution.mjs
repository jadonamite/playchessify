// Decode a transaction's ERC-8021 attribution tag.
//
// The hackathon rules are explicit: a tag cannot be added after a transaction
// is sent, and there is no backfill. So check the FIRST tagged transaction —
// once, early — rather than discovering at the deadline that nothing counted.
//
//   node scripts/verify-attribution.mjs 0x<txhash>
//
// Prints the decoded codes, or exits non-zero if the tx carries no tag.
import { createPublicClient, http } from 'viem'
import { celo } from 'viem/chains'
import { verifyTx } from '@celo/attribution-tags'

const hash = process.argv[2]
if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
  console.error('usage: node scripts/verify-attribution.mjs 0x<txhash>')
  process.exit(2)
}

const client = createPublicClient({
  chain: celo,
  transport: http(process.env.CELO_RPC_URL || 'https://forno.celo.org'),
})

const decoded = await verifyTx({ client, hash })
if (!decoded) {
  console.error(`✗ ${hash} carries NO attribution tag — this transaction is uncounted.`)
  process.exit(1)
}
console.log(`✓ ${hash}`)
console.log(`  codes:    ${decoded.codes.join(', ')}`)
console.log(`  schemaId: ${decoded.schemaId}`)
