// scratch/fund-runtime.cjs — fund oracle/minter/gas-sponsor from the master wallet.
// Oracle + Minter: 15 CELO each. Gas-sponsor: 15 CELO + 1 cUSD.
// Master key read at runtime from ~/Projects/Scripts/.env (EVM_MASTER_PRIVATE_KEY). No keys embedded.
// Run: node scratch/fund-runtime.cjs
const fs = require('fs')
const path = require('path')
const { createWalletClient, createPublicClient, http, parseEther, parseUnits, formatEther, getAddress } = require('viem')
const { privateKeyToAccount } = require('viem/accounts')
const { celo } = require('viem/chains')

const RPC = 'https://forno.celo.org'
const CUSD = getAddress('0x765DE816845861e75A25fCA122bb6898B8B1282a')

const ORACLE = getAddress('0x4d681Ee521B3Db745971Fbf9a2f40D4816cEC6c9')
const MINTER = getAddress('0x45489fd7E62981772641484DFE1698E481975AB9')
const GAS_SPONSOR = getAddress('0xc26f8131F1531BB202e3213564357a09012BD0f2')

const ERC20_TRANSFER = [{
  type: 'function', name: 'transfer', stateMutability: 'nonpayable',
  inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
  outputs: [{ type: 'bool' }],
}]

function masterKey() {
  const env = fs.readFileSync(path.join(process.env.HOME, 'Projects/Scripts/.env'), 'utf8')
  const m = env.match(/^EVM_MASTER_PRIVATE_KEY=(.+)$/m)
  if (!m) throw new Error('EVM_MASTER_PRIVATE_KEY not found')
  let k = m[1].trim()
  return k.startsWith('0x') ? k : '0x' + k
}

async function main() {
  const account = privateKeyToAccount(masterKey())
  const pub = createPublicClient({ chain: celo, transport: http(RPC) })
  const wallet = createWalletClient({ account, chain: celo, transport: http(RPC) })

  console.log('Master:', account.address)
  console.log('Plan:')
  console.log('  Oracle      ', ORACLE, '→ 15 CELO')
  console.log('  Minter      ', MINTER, '→ 15 CELO')
  console.log('  Gas-sponsor ', GAS_SPONSOR, '→ 15 CELO + 1 cUSD')
  console.log()

  const celoSends = [
    ['Oracle CELO', ORACLE, parseEther('15')],
    ['Minter CELO', MINTER, parseEther('15')],
    ['Gas-sponsor CELO', GAS_SPONSOR, parseEther('15')],
  ]

  for (const [label, to, value] of celoSends) {
    const hash = await wallet.sendTransaction({ to, value })
    process.stdout.write(`  ${label}: ${hash} … `)
    const r = await pub.waitForTransactionReceipt({ hash })
    console.log(r.status)
  }

  // 1 cUSD to gas-sponsor (cUSD = 18 decimals)
  const cusdHash = await wallet.writeContract({
    address: CUSD, abi: ERC20_TRANSFER, functionName: 'transfer',
    args: [GAS_SPONSOR, parseUnits('1', 18)],
  })
  process.stdout.write(`  Gas-sponsor cUSD: ${cusdHash} … `)
  const cr = await pub.waitForTransactionReceipt({ hash: cusdHash })
  console.log(cr.status)

  console.log('\nFinal balances:')
  for (const [name, addr] of [['Oracle', ORACLE], ['Minter', MINTER], ['Gas-sponsor', GAS_SPONSOR], ['Master', account.address]]) {
    const bal = await pub.getBalance({ address: addr })
    const cusd = await pub.readContract({ address: CUSD, abi: [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] }], functionName: 'balanceOf', args: [addr] })
    console.log(`  ${name.padEnd(12)} ${formatEther(bal)} CELO · ${formatEther(cusd)} cUSD`)
  }
}

main().catch((e) => { console.error('ERROR:', e.shortMessage || e.message); process.exit(1) })
