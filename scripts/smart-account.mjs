#!/usr/bin/env node
/**
 * Drive your Playchessify smart account from outside the app.
 *
 * The key you export from Settings > Export Wallet is the SIGNER's (an EOA).
 * The smart account is a contract and has no key of its own — the signer is
 * what controls it.
 *
 *   SIGNER_PRIVATE_KEY=0x…   the exported key
 *   SMART_ACCOUNT=0x…        the "Account" address on that same card
 *   CELO_RPC_URL=…           optional, defaults to forno
 *   PIMLICO_API_KEY=…        only for the `userop` path
 *
 * Commands
 *   probe                          what implementation is behind your account
 *   balance [token…]               CELO + ERC-20 balances, and EntryPoint deposit
 *   verify                         which account type derives your address
 *   exec <target> <value> <data>   direct owner call — no bundler
 *   send <token> <to> <amount>     ERC-20 transfer via exec
 *   userop <token> <to> <amount>   same, through a bundler (needs PIMLICO_API_KEY)
 *   deposit <amount>               fund the account's own gas in the EntryPoint
 *
 * ── Which wallet do I get? ───────────────────────────────────────────────────
 * Privy issues a different embedded wallet per app, so the exported key is
 * specific to Chessify — that part is exact. What is NOT guaranteed is
 * re-deriving the smart account address from it: implementation, version,
 * factory and salt all feed a CREATE2 address, and a wrong guess produces a
 * valid, empty, DIFFERENT account. `verify` brute-forces the common types and
 * tells you; every write asserts the address first and refuses on a mismatch.
 *
 * The direct paths (`exec`, `send`) skip derivation entirely — they call the
 * address you already know. Prefer them.
 *
 * ── Gas ──────────────────────────────────────────────────────────────────────
 * `exec` is an ordinary transaction, so the SIGNER pays in CELO. Fund the
 * signer EOA with a little CELO and nothing else is needed.
 *
 * `userop` goes through ERC-4337. Without a paymaster the EntryPoint charges
 * the account's DEPOSIT INSIDE THE ENTRYPOINT, not the balance at the account's
 * own address — sending CELO to the account is not enough and fails validation
 * with "AA21 didn't pay prefund". Use `deposit` (anyone may fund any account).
 * A bundler is still required either way; a paymaster is not.
 */

import {
  createPublicClient, createWalletClient, http, encodeFunctionData,
  parseUnits, formatUnits, formatEther, parseEther, getAddress,
} from 'viem'
import { celo } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { entryPoint07Address } from 'viem/account-abstraction'

const need = (k) => {
  const v = process.env[k]
  if (!v) { console.error(`missing ${k}`); process.exit(2) }
  return v
}

const KEY = need('SIGNER_PRIVATE_KEY')
const ACCOUNT = getAddress(need('SMART_ACCOUNT'))
const RPC = process.env.CELO_RPC_URL || 'https://forno.celo.org'

const owner = privateKeyToAccount(KEY.startsWith('0x') ? KEY : `0x${KEY}`)
const pub = createPublicClient({ chain: celo, transport: http(RPC) })
const wallet = createWalletClient({ account: owner, chain: celo, transport: http(RPC) })

const ENTRY_POINT = entryPoint07Address
const ERC1967_IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'

const ERC20 = [
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'v', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
]

// execute(address,uint256,bytes) — SimpleAccount, Kernel v2, LightAccount.
const EXEC_ABI = [{
  type: 'function', name: 'execute', stateMutability: 'payable',
  inputs: [{ name: 'target', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' }],
  outputs: [],
}]

const ENTRY_ABI = [
  { type: 'function', name: 'depositTo', stateMutability: 'payable', inputs: [{ name: 'account', type: 'address' }], outputs: [] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
]

/** Selectors worth recognising when identifying an implementation. */
const SELECTORS = {
  'b61d27f6': 'execute(address,uint256,bytes)      SimpleAccount / Kernel v2 / Light',
  'e9ae5c53': 'execute(bytes32,bytes)              Kernel v3 / Nexus (ERC-7579)',
  '6a761202': 'execTransaction(...)                Safe',
  '18dfb3c7': 'executeBatch(address[],bytes[])',
  '47e1da2a': 'executeBatch(address[],uint256[],bytes[])',
  'b0d691fe': 'entryPoint()',
  '8da5cb5b': 'owner()',
  'a0e67e2b': 'getOwners()                         Safe',
}

async function probe() {
  const code = await pub.getCode({ address: ACCOUNT })
  if (!code || code === '0x') {
    console.log('No code at that address — the account is counterfactual (never deployed).')
    console.log('It deploys on its first userOp. `exec` cannot work until then.')
    return
  }
  console.log(`account      ${ACCOUNT}`)
  console.log(`code size    ${(code.length - 2) / 2} bytes`)

  const slot = await pub.getStorageAt({ address: ACCOUNT, slot: ERC1967_IMPL_SLOT })
  const impl = slot && slot !== `0x${'0'.repeat(64)}` ? getAddress(`0x${slot.slice(-40)}`) : null
  console.log(`proxy impl   ${impl ?? 'not an ERC-1967 proxy (or a different slot)'}`)

  const target = impl ?? ACCOUNT
  const body = await pub.getCode({ address: target })
  console.log(`\nselectors found in ${impl ? 'implementation' : 'account'}:`)
  let any = false
  for (const [sel, label] of Object.entries(SELECTORS)) {
    if (body?.includes(sel)) { console.log(`  ${sel}  ${label}`); any = true }
  }
  if (!any) console.log('  none recognised — likely ERC-7579 modular or a custom build')

  const deposit = await pub.readContract({ address: ENTRY_POINT, abi: ENTRY_ABI, functionName: 'balanceOf', args: [ACCOUNT] })
  console.log(`\nEntryPoint deposit  ${formatEther(deposit)} CELO`)
  console.log('(that deposit, not the account balance, is what pays for a userOp)')
}

async function balance(tokens) {
  const [native, signer, deposit] = await Promise.all([
    pub.getBalance({ address: ACCOUNT }),
    pub.getBalance({ address: owner.address }),
    pub.readContract({ address: ENTRY_POINT, abi: ENTRY_ABI, functionName: 'balanceOf', args: [ACCOUNT] }),
  ])
  console.log(`account ${ACCOUNT}`)
  console.log(`  CELO              ${formatEther(native)}`)
  console.log(`  EntryPoint depo   ${formatEther(deposit)}`)
  for (const t of tokens) {
    const a = getAddress(t)
    const [sym, dec, bal] = await Promise.all([
      pub.readContract({ address: a, abi: ERC20, functionName: 'symbol' }),
      pub.readContract({ address: a, abi: ERC20, functionName: 'decimals' }),
      pub.readContract({ address: a, abi: ERC20, functionName: 'balanceOf', args: [ACCOUNT] }),
    ])
    console.log(`  ${sym.padEnd(17)} ${formatUnits(bal, dec)}`)
  }
  console.log(`signer  ${owner.address}`)
  console.log(`  CELO              ${formatEther(signer)}   (pays for \`exec\`)`)
}

async function verify() {
  const { toKernelSmartAccount, toSafeSmartAccount, toSimpleSmartAccount, toLightSmartAccount, toNexusSmartAccount } =
    await import('permissionless/accounts')
  const entryPoint = { address: ENTRY_POINT, version: '0.7' }
  const candidates = {
    kernel: () => toKernelSmartAccount({ client: pub, owners: [owner], entryPoint }),
    safe: () => toSafeSmartAccount({ client: pub, owners: [owner], entryPoint, version: '1.4.1' }),
    simple: () => toSimpleSmartAccount({ client: pub, owner, entryPoint }),
    light: () => toLightSmartAccount({ client: pub, owner, entryPoint, version: '2.0.0' }),
    nexus: () => toNexusSmartAccount({ client: pub, owners: [owner], entryPoint }),
  }
  console.log(`signer   ${owner.address}`)
  console.log(`looking for ${ACCOUNT}\n`)
  let hit = null
  for (const [name, make] of Object.entries(candidates)) {
    try {
      const a = await make()
      const match = getAddress(a.address) === ACCOUNT
      console.log(`  ${name.padEnd(7)} ${a.address} ${match ? '  <== MATCH' : ''}`)
      if (match) hit = name
    } catch (e) {
      console.log(`  ${name.padEnd(7)} (could not derive: ${String(e.shortMessage || e.message).slice(0, 60)})`)
    }
  }
  console.log(hit
    ? `\nACCOUNT_TYPE=${hit}`
    : '\nNo match. The factory, version or salt differs from these defaults — use the\n' +
      'direct `exec` path, which needs no derivation, or read the exact config off\n' +
      'the Privy dashboard.')
}

/** Direct owner call. No bundler, no EntryPoint; the signer pays gas in CELO. */
async function exec(target, value, data) {
  const bal = await pub.getBalance({ address: owner.address })
  if (bal === 0n) {
    console.error(`signer ${owner.address} has no CELO — it pays the gas for a direct call.`)
    process.exit(1)
  }
  const hash = await wallet.writeContract({
    address: ACCOUNT,
    abi: EXEC_ABI,
    functionName: 'execute',
    args: [getAddress(target), BigInt(value), data],
  })
  console.log(`sent ${hash}`)
  const r = await pub.waitForTransactionReceipt({ hash })
  console.log(r.status)
}

async function send(token, to, amount) {
  const a = getAddress(token)
  const dec = await pub.readContract({ address: a, abi: ERC20, functionName: 'decimals' })
  const data = encodeFunctionData({ abi: ERC20, functionName: 'transfer', args: [getAddress(to), parseUnits(amount, dec)] })
  await exec(a, 0, data)
}

async function deposit(amount) {
  const hash = await wallet.writeContract({
    address: ENTRY_POINT, abi: ENTRY_ABI, functionName: 'depositTo',
    args: [ACCOUNT], value: parseEther(amount),
  })
  console.log(`sent ${hash}`)
  await pub.waitForTransactionReceipt({ hash })
  const d = await pub.readContract({ address: ENTRY_POINT, abi: ENTRY_ABI, functionName: 'balanceOf', args: [ACCOUNT] })
  console.log(`deposit now ${formatEther(d)} CELO`)
}

/** The 4337 path. Needs a bundler; a paymaster only if you want it sponsored. */
async function userop(token, to, amount) {
  const apikey = need('PIMLICO_API_KEY')
  const type = process.env.ACCOUNT_TYPE
  if (!type) { console.error('set ACCOUNT_TYPE (run `verify` first)'); process.exit(2) }

  const { createSmartAccountClient } = await import('permissionless')
  const { createPimlicoClient } = await import('permissionless/clients/pimlico')
  const accounts = await import('permissionless/accounts')
  const entryPoint = { address: ENTRY_POINT, version: '0.7' }

  const make = {
    kernel: () => accounts.toKernelSmartAccount({ client: pub, owners: [owner], entryPoint }),
    safe: () => accounts.toSafeSmartAccount({ client: pub, owners: [owner], entryPoint, version: '1.4.1' }),
    simple: () => accounts.toSimpleSmartAccount({ client: pub, owner, entryPoint }),
    light: () => accounts.toLightSmartAccount({ client: pub, owner, entryPoint, version: '2.0.0' }),
    nexus: () => accounts.toNexusSmartAccount({ client: pub, owners: [owner], entryPoint }),
  }[type]
  if (!make) { console.error(`unknown ACCOUNT_TYPE ${type}`); process.exit(2) }

  const account = await make()
  if (getAddress(account.address) !== ACCOUNT) {
    console.error(`MISMATCH: ${type} derives ${account.address}, not ${ACCOUNT}.`)
    console.error('That is a different, empty account. Refusing to send.')
    process.exit(1)
  }

  const url = `https://api.pimlico.io/v2/${celo.id}/rpc?apikey=${apikey}`
  const pimlico = createPimlicoClient({ transport: http(url), entryPoint })
  const client = createSmartAccountClient({
    account, chain: celo, bundlerTransport: http(url),
    // Drop `paymaster` to spend the account's own EntryPoint deposit instead.
    paymaster: process.env.SELF_FUNDED === '1' ? undefined : pimlico,
    userOperation: { estimateFeesPerGas: async () => (await pimlico.getUserOperationGasPrice()).fast },
  })

  const a = getAddress(token)
  const dec = await pub.readContract({ address: a, abi: ERC20, functionName: 'decimals' })
  const hash = await client.sendTransaction({
    to: a,
    data: encodeFunctionData({ abi: ERC20, functionName: 'transfer', args: [getAddress(to), parseUnits(amount, dec)] }),
  })
  console.log(`sent ${hash}`)
  await pub.waitForTransactionReceipt({ hash })
  console.log('confirmed')
}

const [cmd, ...rest] = process.argv.slice(2)
const run = {
  probe: () => probe(),
  balance: () => balance(rest),
  verify: () => verify(),
  exec: () => exec(rest[0], rest[1] ?? 0, rest[2] ?? '0x'),
  send: () => send(rest[0], rest[1], rest[2]),
  deposit: () => deposit(rest[0]),
  userop: () => userop(rest[0], rest[1], rest[2]),
}[cmd || 'probe']

if (!run) {
  console.error('commands: probe | balance [token…] | verify | exec | send | deposit | userop')
  process.exit(2)
}
run().catch((e) => { console.error(e?.shortMessage || e?.message || e); process.exit(1) })
