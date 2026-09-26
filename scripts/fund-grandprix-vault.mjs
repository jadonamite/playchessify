#!/usr/bin/env node
/**
 * Seed a concluded season's prize pot in TournamentRewards.
 *
 * openSeason() whitelists winners and pulls the total USDm from the owner
 * wallet in one tx. It seeds a season id ONCE — a second call reverts with
 * SeasonAlreadyOpen, so a wrong list is only recoverable by sweep() after the
 * claim deadline. Dry-run first, always.
 *
 *   EVM_MASTER_PRIVATE_KEY=0x…   vault owner (0xF679…7638)
 *   UPSTASH_REDIS_REST_URL/TOKEN read the final board
 *
 *   node scripts/fund-grandprix-vault.mjs <tournamentId> [--claim-days N] [--execute]
 *
 * Without --execute it prints the decoded call and sends nothing.
 */

import { createPublicClient, createWalletClient, http, parseUnits, formatUnits, formatEther, getAddress } from 'viem'
import { celo } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const VAULT = getAddress('0xd867C2467c41Ccbe315eF4fFa3B9eBFa0C2D8d24')
const USDM  = getAddress('0x765DE816845861e75A25fCA122bb6898B8B1282a')

const args = process.argv.slice(2)
const EXECUTE = args.includes('--execute')
const TRN = args.find((a) => !a.startsWith('--')) || 'S2'
const CLAIM_DAYS = Number(args[args.indexOf('--claim-days') + 1]) || 30

const need = (k) => { const v = process.env[k]; if (!v) { console.error(`missing ${k}`); process.exit(2) } return v }

const ERC20 = [
  { type:'function', name:'balanceOf', stateMutability:'view', inputs:[{type:'address'}], outputs:[{type:'uint256'}] },
  { type:'function', name:'allowance', stateMutability:'view', inputs:[{type:'address'},{type:'address'}], outputs:[{type:'uint256'}] },
  { type:'function', name:'approve', stateMutability:'nonpayable', inputs:[{type:'address'},{type:'uint256'}], outputs:[{type:'bool'}] },
]
const VAULT_ABI = [
  { type:'function', name:'owner', stateMutability:'view', inputs:[], outputs:[{type:'address'}] },
  { type:'function', name:'seasons', stateMutability:'view', inputs:[{type:'uint256'}],
    outputs:[{name:'token',type:'address'},{name:'claimDeadline',type:'uint64'},{name:'funded',type:'uint128'},{name:'claimed',type:'uint128'},{name:'swept',type:'bool'}] },
  { type:'function', name:'openSeason', stateMutability:'nonpayable',
    inputs:[{name:'seasonId',type:'uint256'},{name:'token',type:'address'},{name:'winners',type:'address[]'},{name:'amounts',type:'uint256[]'},{name:'claimWindow',type:'uint64'}], outputs:[] },
]

async function redisGet(key) {
  const url = need('UPSTASH_REDIS_REST_URL'), token = need('UPSTASH_REDIS_REST_TOKEN')
  const r = await fetch(`${url}/get/${key}`, { headers: { Authorization: `Bearer ${token}` } })
  const j = await r.json()
  if (!j.result) throw new Error(`redis key ${key} is empty`)
  return JSON.parse(j.result)
}

const owner = privateKeyToAccount(need('EVM_MASTER_PRIVATE_KEY').replace(/^(0x)?/, '0x'))
const pub = createPublicClient({ chain: celo, transport: http(process.env.CELO_RPC_URL || 'https://forno.celo.org') })
const wallet = createWalletClient({ account: owner, chain: celo, transport: http(process.env.CELO_RPC_URL || 'https://forno.celo.org') })

const final = await redisGet(`chess:trn:${TRN}:final`)
const win = final.window
if (win.status !== 'ended') throw new Error(`${TRN} status is "${win.status}", not ended`)

const seasonId = BigInt(win.contractSeasonId)
const eligible = final.board.filter((e) => e.eligible)
const winners = win.splits.map((s, i) => {
  const e = eligible[i]
  if (!e) throw new Error(`no eligible player for place ${s.place}`)
  return { place: s.place, address: getAddress(e.address), amount: parseUnits(String(s.amount), 18), xp: e.xp }
})
const total = winners.reduce((a, w) => a + w.amount, 0n)

// A tie straddling the paid cut would make the ordering arbitrary — stop.
const cut = eligible[winners.length]
if (cut && cut.xp === eligible[winners.length - 1].xp) {
  throw new Error(`tie at the cut: rank ${winners.length} and ${winners.length + 1} both have ${cut.xp} XP`)
}

const [onchainOwner, season, bal, allowance] = await Promise.all([
  pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: 'owner' }),
  pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: 'seasons', args: [seasonId] }),
  pub.readContract({ address: USDM, abi: ERC20, functionName: 'balanceOf', args: [owner.address] }),
  pub.readContract({ address: USDM, abi: ERC20, functionName: 'allowance', args: [owner.address, VAULT] }),
])

console.log(`tournament   ${TRN} (${win.name}) — ${win.status}`)
console.log(`season id    ${seasonId}  (on-chain)`)
console.log(`signer       ${owner.address}`)
console.log(`vault owner  ${onchainOwner}`)
console.log(`token        USDm ${USDM}`)
console.log(`claim window ${CLAIM_DAYS} days\n`)
for (const w of winners) console.log(`  #${w.place}  ${w.address}  ${formatUnits(w.amount, 18).padStart(6)} USDm   (xp ${w.xp})`)
console.log(`\ntotal        ${formatUnits(total, 18)} USDm`)
console.log(`owner USDm   ${formatUnits(bal, 18)}`)
console.log(`allowance    ${formatUnits(allowance, 18)}`)

if (getAddress(onchainOwner) !== getAddress(owner.address)) { console.error('\nsigner is not the vault owner — refusing.'); process.exit(1) }
if (season[0] !== '0x0000000000000000000000000000000000000000') { console.error(`\nseason ${seasonId} is ALREADY open — openSeason would revert.`); process.exit(1) }
if (bal < total) { console.error(`\nowner holds ${formatUnits(bal,18)} USDm, needs ${formatUnits(total,18)}.`); process.exit(1) }

if (!EXECUTE) { console.log('\nDRY RUN — nothing sent. Re-run with --execute to broadcast.'); process.exit(0) }

if (allowance < total) {
  console.log('\napproving…')
  const h = await wallet.writeContract({ address: USDM, abi: ERC20, functionName: 'approve', args: [VAULT, total] })
  console.log(`  approve ${h}`)
  console.log(`  ${(await pub.waitForTransactionReceipt({ hash: h })).status}`)
}

console.log('opening season…')
const hash = await wallet.writeContract({
  address: VAULT, abi: VAULT_ABI, functionName: 'openSeason',
  args: [seasonId, USDM, winners.map((w) => w.address), winners.map((w) => w.amount), BigInt(CLAIM_DAYS * 86400)],
})
console.log(`  openSeason ${hash}`)
const r = await pub.waitForTransactionReceipt({ hash })
console.log(`  ${r.status}`)

// The receipt can land before the RPC node serving reads has the block, which
// reads back as an all-zero season. Retry until it reflects the write.
let after
for (let i = 0; i < 10; i++) {
  after = await pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: 'seasons', args: [seasonId], blockNumber: r.blockNumber })
    .catch(() => pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: 'seasons', args: [seasonId] }))
  if (after[0] !== '0x0000000000000000000000000000000000000000') break
  await new Promise((res) => setTimeout(res, 1500))
}
console.log(`\nseason ${seasonId} funded ${formatUnits(after[2], 18)} USDm, claim deadline ${new Date(Number(after[1]) * 1000).toISOString()}`)
console.log(`gas left     ${formatEther(await pub.getBalance({ address: owner.address }))} CELO`)
