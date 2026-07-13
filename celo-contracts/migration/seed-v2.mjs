// Seed the v2 contracts from migration/snapshot.json.
//
// Pushes the v1 snapshot into ChessGame.importStats and ChessToken.batchMint in
// chunks, as the owner. Dry-run by default — pass --broadcast to send, and
// --lock to call lockStatsSeed() after a verified seed.
//
// Usage (from repo root):
//   V2_GAME=0x... V2_TOKEN=0x... DEPLOYER_PRIVATE_KEY=0x... \
//     node celo-contracts/migration/seed-v2.mjs [--broadcast] [--lock] [--lock-only]
//
// --lock-only skips the seed and just calls lockStatsSeed() — use it after a
// verified seed. Re-seeding an already-seeded token double-mints, so the seed
// aborts if the first snapshot holder already has a balance.
//
// Optional: CELO_NETWORK=alfajores to rehearse on testnet.

import { createPublicClient, createWalletClient, http, getAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, celoAlfajores } from 'viem/chains'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BROADCAST = process.argv.includes('--broadcast')
const LOCK_ONLY = process.argv.includes('--lock-only')
const LOCK = LOCK_ONLY || process.argv.includes('--lock')
const CHUNK = 150 // rows per tx — comfortably inside the block gas limit

const IS_TESTNET = process.env.CELO_NETWORK === 'alfajores'
const CHAIN = IS_TESTNET ? celoAlfajores : celo
const RPC = IS_TESTNET ? 'https://alfajores-forno.celo-testnet.org' : 'https://forno.celo.org'

const V2_GAME = getAddress(required('V2_GAME'))
const V2_TOKEN = getAddress(required('V2_TOKEN'))

function required(name) {
  const v = process.env[name]
  if (!v) { console.error(`${name} must be set`); process.exit(1) }
  return v
}

const GAME_ABI = [
  {
    type: 'function', name: 'importStats', stateMutability: 'nonpayable',
    inputs: [
      { name: 'players', type: 'address[]' },
      {
        name: 'stats', type: 'tuple[]',
        components: [
          { name: 'wins', type: 'uint256' },
          { name: 'losses', type: 'uint256' },
          { name: 'draws', type: 'uint256' },
          { name: 'rating', type: 'uint256' },
          { name: 'gamesPlayed', type: 'uint256' },
        ],
      },
    ],
    outputs: [],
  },
  { type: 'function', name: 'lockStatsSeed', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'statsSeedLocked', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
]

const TOKEN_ABI = [{
  type: 'function', name: 'batchMint', stateMutability: 'nonpayable',
  inputs: [
    { name: 'recipients', type: 'address[]' },
    { name: 'amounts', type: 'uint256[]' },
  ],
  outputs: [],
}, {
  type: 'function', name: 'balanceOf', stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ type: 'uint256' }],
}]

function chunks(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function main() {
  const snapshotPath = join(dirname(fileURLToPath(import.meta.url)), 'snapshot.json')
  const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'))
  console.log(`snapshot from ${snapshot.takenAt} @ block ${snapshot.block}: ` +
    `${snapshot.stats.length} stat rows, ${snapshot.balances.length} balances`)

  const pub = createPublicClient({ chain: CHAIN, transport: http(RPC) })
  const account = privateKeyToAccount(
    required('DEPLOYER_PRIVATE_KEY').startsWith('0x')
      ? process.env.DEPLOYER_PRIVATE_KEY
      : `0x${process.env.DEPLOYER_PRIVATE_KEY}`,
  )
  const wallet = createWalletClient({ account, chain: CHAIN, transport: http(RPC) })

  const locked = await pub.readContract({ address: V2_GAME, abi: GAME_ABI, functionName: 'statsSeedLocked' })
  if (locked) {
    console.error('statsSeedLocked is already true — stats cannot be seeded. Aborting.')
    process.exit(1)
  }

  if (!LOCK_ONLY) {
    // batchMint is additive — a second seed run doubles every balance.
    const firstHolder = snapshot.balances[0]?.holder
    if (firstHolder) {
      const bal = await pub.readContract({
        address: V2_TOKEN, abi: TOKEN_ABI, functionName: 'balanceOf', args: [firstHolder],
      })
      if (bal > 0n) {
        console.error(`${firstHolder} already holds ${bal} — token looks seeded. Use --lock-only. Aborting.`)
        process.exit(1)
      }
    }
  }

  const statBatches = LOCK_ONLY ? [] : chunks(snapshot.stats, CHUNK)
  const balanceBatches = LOCK_ONLY ? [] : chunks(snapshot.balances, CHUNK)
  console.log(`${statBatches.length} importStats tx(s) + ${balanceBatches.length} batchMint tx(s)` +
    (BROADCAST ? '' : '  [DRY RUN — pass --broadcast to send]'))

  for (const [i, batch] of statBatches.entries()) {
    const players = batch.map((r) => r.player)
    const stats = batch.map((r) => ({
      wins: BigInt(r.wins), losses: BigInt(r.losses), draws: BigInt(r.draws),
      rating: BigInt(r.rating), gamesPlayed: BigInt(r.gamesPlayed),
    }))
    if (!BROADCAST) { console.log(`importStats #${i + 1}: ${players.length} players`); continue }
    const hash = await wallet.writeContract({
      address: V2_GAME, abi: GAME_ABI, functionName: 'importStats', args: [players, stats],
    })
    await pub.waitForTransactionReceipt({ hash })
    console.log(`importStats #${i + 1}/${statBatches.length}: ${players.length} players → ${hash}`)
  }

  for (const [i, batch] of balanceBatches.entries()) {
    const recipients = batch.map((r) => r.holder)
    const amounts = batch.map((r) => BigInt(r.amount))
    if (!BROADCAST) { console.log(`batchMint #${i + 1}: ${recipients.length} holders`); continue }
    const hash = await wallet.writeContract({
      address: V2_TOKEN, abi: TOKEN_ABI, functionName: 'batchMint', args: [recipients, amounts],
    })
    await pub.waitForTransactionReceipt({ hash })
    console.log(`batchMint #${i + 1}/${balanceBatches.length}: ${recipients.length} holders → ${hash}`)
  }

  if (LOCK) {
    if (!BROADCAST) { console.log('lockStatsSeed  [DRY RUN]'); return }
    const hash = await wallet.writeContract({ address: V2_GAME, abi: GAME_ABI, functionName: 'lockStatsSeed' })
    await pub.waitForTransactionReceipt({ hash })
    console.log(`lockStatsSeed → ${hash}`)
  } else {
    console.log('stats seed left UNLOCKED — verify on-chain, then re-run with --lock')
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
