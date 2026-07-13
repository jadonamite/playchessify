// Credit v1 escrow on v2: CHESS still locked in open v1 games at cutover.
//
// v1 cannot be swept centrally (cancelGame is creator-only), so instead we
// enumerate every v1 game still holding funds — Waiting (creator's wager) or
// Active (both players' wagers) — and mint the equivalent on the v2 token.
// The per-player total is cross-checked against the v1 contract's actual
// CHESS balance before anything is sent.
//
// Dry-run by default — pass --broadcast to mint.
//
// Usage (from repo root):
//   V2_TOKEN=0x... DEPLOYER_PRIVATE_KEY=0x... \
//     node celo-contracts/migration/refund-v1-escrow.mjs [--broadcast]

import { createPublicClient, createWalletClient, http, getAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo } from 'viem/chains'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BROADCAST = process.argv.includes('--broadcast')
const CHUNK = 150

const V1_GAME = getAddress(process.env.V1_GAME ?? '0xb37877a9ebd6c3169b2eaaa3e16852839785ae85')
const V1_TOKEN = getAddress(process.env.V1_TOKEN ?? '0x3f7efdfc8a76f76f22512fcd2bddc5fca36e55a3')
const V2_TOKEN = getAddress(required('V2_TOKEN'))
const RPC = process.env.CELO_RPC ?? 'https://forno.celo.org'

function required(name) {
  const v = process.env[name]
  if (!v) { console.error(`${name} must be set`); process.exit(1) }
  return v
}

const V1_GAME_ABI = [
  {
    type: 'function', name: 'gameNonce', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'getGame', stateMutability: 'view',
    inputs: [{ name: 'gameId', type: 'uint256' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'white', type: 'address' },
        { name: 'black', type: 'address' },
        { name: 'wager', type: 'uint256' },
        { name: 'status', type: 'uint8' },
        { name: 'result', type: 'uint8' },
        { name: 'createdAt', type: 'uint256' },
        { name: 'drawProposer', type: 'address' },
      ],
    }],
  },
]

const ERC20_ABI = [{
  type: 'function', name: 'balanceOf', stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ type: 'uint256' }],
}]

const V2_TOKEN_ABI = [{
  type: 'function', name: 'batchMint', stateMutability: 'nonpayable',
  inputs: [
    { name: 'recipients', type: 'address[]' },
    { name: 'amounts', type: 'uint256[]' },
  ],
  outputs: [],
}]

const WAITING = 0
const ACTIVE = 1

function chunks(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function main() {
  const pub = createPublicClient({ chain: celo, transport: http(RPC) })

  const nonce = await pub.readContract({ address: V1_GAME, abi: V1_GAME_ABI, functionName: 'gameNonce' })
  console.log(`v1 gameNonce: ${nonce} — scanning games for locked escrow`)

  const owed = new Map() // address -> bigint
  const openGames = []
  const credit = (addr, amount) => owed.set(addr, (owed.get(addr) ?? 0n) + amount)

  const BATCH = 100
  for (let start = 0n; start < nonce; start += BigInt(BATCH)) {
    const end = start + BigInt(BATCH) > nonce ? nonce : start + BigInt(BATCH)
    const ids = []
    for (let id = start; id < end; id++) ids.push(id)
    const results = await pub.multicall({
      contracts: ids.map((id) => ({
        address: V1_GAME, abi: V1_GAME_ABI, functionName: 'getGame', args: [id],
      })),
      allowFailure: false,
    })
    for (const [i, g] of results.entries()) {
      if (g.wager === 0n) continue
      if (g.status === WAITING) {
        credit(g.white, g.wager)
        openGames.push({ id: ids[i].toString(), status: 'Waiting', white: g.white, wager: g.wager.toString() })
      } else if (g.status === ACTIVE) {
        credit(g.white, g.wager)
        credit(g.black, g.wager)
        openGames.push({ id: ids[i].toString(), status: 'Active', white: g.white, black: g.black, wager: g.wager.toString() })
      }
    }
  }

  const total = [...owed.values()].reduce((a, b) => a + b, 0n)
  const escrow = await pub.readContract({
    address: V1_TOKEN, abi: ERC20_ABI, functionName: 'balanceOf', args: [V1_GAME],
  })
  console.log(`${openGames.length} open games → ${owed.size} players owed ${total} (v1 escrow holds ${escrow})`)
  if (total !== escrow) {
    console.error('computed refunds do not equal the v1 escrow balance — investigate before minting. Aborting.')
    process.exit(1)
  }

  const outPath = join(dirname(fileURLToPath(import.meta.url)), 'v1-escrow-refunds.json')
  const rows = [...owed.entries()].map(([holder, amount]) => ({ holder, amount: amount.toString() }))
  writeFileSync(outPath, JSON.stringify({ takenAt: new Date().toISOString(), total: total.toString(), openGames, refunds: rows }, null, 2))
  console.log(`wrote ${rows.length} refunds → ${outPath}`)

  if (!BROADCAST) { console.log('[DRY RUN — pass --broadcast to mint on v2]'); return }

  const account = privateKeyToAccount(
    required('DEPLOYER_PRIVATE_KEY').startsWith('0x')
      ? process.env.DEPLOYER_PRIVATE_KEY
      : `0x${process.env.DEPLOYER_PRIVATE_KEY}`,
  )
  const wallet = createWalletClient({ account, chain: celo, transport: http(RPC) })

  for (const [i, batch] of chunks(rows, CHUNK).entries()) {
    const hash = await wallet.writeContract({
      address: V2_TOKEN, abi: V2_TOKEN_ABI, functionName: 'batchMint',
      args: [batch.map((r) => r.holder), batch.map((r) => BigInt(r.amount))],
    })
    await pub.waitForTransactionReceipt({ hash })
    console.log(`batchMint #${i + 1}: ${batch.length} refunds → ${hash}`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
