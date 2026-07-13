// Snapshot v1 state for the v2 migration.
//
// Enumerates every player (GameCreated/GameJoined logs) and every CHESS holder
// (Transfer logs) on the v1 contracts, then reads playerStats + balanceOf for
// each and writes migration/snapshot.json. Read-only — safe to re-run; the
// final run should happen after v1 is frozen so the snapshot can't go stale.
//
// Usage (from repo root):
//   node celo-contracts/migration/snapshot-v1.mjs
//
// Env (optional): V1_GAME / V1_TOKEN to override the live mainnet addresses.

import { createPublicClient, http, parseAbiItem, getAddress } from 'viem'
import { celo } from 'viem/chains'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const V1_GAME = getAddress(process.env.V1_GAME ?? '0xb37877a9ebd6c3169b2eaaa3e16852839785ae85')
const V1_TOKEN = getAddress(process.env.V1_TOKEN ?? '0x3f7efdfc8a76f76f22512fcd2bddc5fca36e55a3')

const LOG_CHUNK = 5_000n // forno's getLogs range limit
const OUT_PATH = join(dirname(fileURLToPath(import.meta.url)), 'snapshot.json')

const client = createPublicClient({ chain: celo, transport: http('https://forno.celo.org') })

const GAME_CREATED = parseAbiItem('event GameCreated(uint256 indexed gameId, address indexed white, uint256 wager)')
const GAME_JOINED = parseAbiItem('event GameJoined(uint256 indexed gameId, address indexed black)')
const TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')

const STATS_ABI = [{
  type: 'function',
  name: 'getPlayerStats',
  stateMutability: 'view',
  inputs: [{ name: 'player', type: 'address' }],
  outputs: [{
    type: 'tuple',
    components: [
      { name: 'wins', type: 'uint256' },
      { name: 'losses', type: 'uint256' },
      { name: 'draws', type: 'uint256' },
      { name: 'rating', type: 'uint256' },
      { name: 'gamesPlayed', type: 'uint256' },
    ],
  }],
}]

const BALANCE_ABI = [{
  type: 'function',
  name: 'balanceOf',
  stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ type: 'uint256' }],
}]

/** First block where the contract has code (its deployment block), by bisection. */
async function deployBlock(address) {
  let lo = 0n
  let hi = await client.getBlockNumber()
  while (lo < hi) {
    const mid = (lo + hi) / 2n
    const code = await client.getCode({ address, blockNumber: mid })
    if (code && code !== '0x') hi = mid
    else lo = mid + 1n
  }
  return lo
}

async function collectLogs(address, event, fromBlock, toBlock) {
  const logs = []
  for (let start = fromBlock; start <= toBlock; start += LOG_CHUNK) {
    const end = start + LOG_CHUNK - 1n > toBlock ? toBlock : start + LOG_CHUNK - 1n
    for (let attempt = 1; ; attempt++) {
      try {
        logs.push(...await client.getLogs({ address, event, fromBlock: start, toBlock: end }))
        break
      } catch (err) {
        if (attempt >= 5) throw err
        await new Promise((r) => setTimeout(r, 1000 * attempt))
      }
    }
  }
  return logs
}

async function multiRead(contract, abi, fn, addresses) {
  const out = new Map()
  const BATCH = 200
  for (let i = 0; i < addresses.length; i += BATCH) {
    const slice = addresses.slice(i, i + BATCH)
    const results = await client.multicall({
      contracts: slice.map((addr) => ({ address: contract, abi, functionName: fn, args: [addr] })),
      allowFailure: false,
    })
    slice.forEach((addr, j) => out.set(addr, results[j]))
  }
  return out
}

async function main() {
  const latest = await client.getBlockNumber()
  const gameFrom = await deployBlock(V1_GAME)
  const tokenFrom = await deployBlock(V1_TOKEN)
  console.log(`v1 game ${V1_GAME} deployed @ ${gameFrom}; token ${V1_TOKEN} @ ${tokenFrom}; head ${latest}`)

  // Players: anyone who ever created or joined a game.
  const [created, joined] = await Promise.all([
    collectLogs(V1_GAME, GAME_CREATED, gameFrom, latest),
    collectLogs(V1_GAME, GAME_JOINED, gameFrom, latest),
  ])
  const players = [...new Set([
    ...created.map((l) => getAddress(l.args.white)),
    ...joined.map((l) => getAddress(l.args.black)),
  ])]
  console.log(`${created.length} creates + ${joined.length} joins → ${players.length} unique players`)

  // Holders: any address that ever received CHESS.
  const transfers = await collectLogs(V1_TOKEN, TRANSFER, tokenFrom, latest)
  const holders = [...new Set(transfers.map((l) => getAddress(l.args.to)))]
    .filter((a) => a !== '0x0000000000000000000000000000000000000000' && a !== V1_GAME)
  console.log(`${transfers.length} transfers → ${holders.length} candidate holders`)

  const stats = await multiRead(V1_GAME, STATS_ABI, 'getPlayerStats', players)
  const balances = await multiRead(V1_TOKEN, BALANCE_ABI, 'balanceOf', holders)

  const snapshot = {
    takenAt: new Date().toISOString(),
    block: latest.toString(),
    v1: { game: V1_GAME, token: V1_TOKEN },
    // rating 0 means the address never actually initialised (shouldn't happen for
    // a create/join participant, but filter defensively — v2 seeds only real stats).
    stats: players
      .map((addr) => ({ addr, s: stats.get(addr) }))
      .filter(({ s }) => s && s.rating > 0n)
      .map(({ addr, s }) => ({
        player: addr,
        wins: s.wins.toString(),
        losses: s.losses.toString(),
        draws: s.draws.toString(),
        rating: s.rating.toString(),
        gamesPlayed: s.gamesPlayed.toString(),
      })),
    balances: holders
      .map((addr) => ({ addr, bal: balances.get(addr) }))
      .filter(({ bal }) => bal && bal > 0n)
      .map(({ addr, bal }) => ({ holder: addr, amount: bal.toString() })),
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(snapshot, null, 2))
  console.log(`wrote ${snapshot.stats.length} stat rows + ${snapshot.balances.length} balances → ${OUT_PATH}`)
}

main().catch((err) => { console.error(err); process.exit(1) })
