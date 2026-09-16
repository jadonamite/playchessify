// Mint the ERC-8004 agent identity for Playchessify on Celo mainnet.
//
//   DRY RUN (default) — simulates, prints the agentId it would mint, sends nothing:
//     node tools/register-agent.mjs
//
//   SEND — mints the NFT for real, costs gas, permanent and public:
//     AGENT_OWNER_PRIVATE_KEY=0x… node tools/register-agent.mjs --send
//
// The owner wallet becomes the holder of the agent NFT, so use a key you intend
// to keep: transferring it transfers the identity.
import { createPublicClient, createWalletClient, http, decodeEventLog } from 'viem'
import { celo } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
const AGENT_URI =
  process.env.AGENT_URI ?? 'https://celo.playchessify.xyz/.well-known/agent.json'
const SEND = process.argv.includes('--send')

const ABI = [
  {
    type: 'function', name: 'register', stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    type: 'event', name: 'Transfer', inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
    ],
  },
]

const publicClient = createPublicClient({
  chain: celo,
  transport: http(process.env.CELO_RPC_URL || 'https://forno.celo.org'),
})

// The registration file must resolve before minting — the agentURI is what other
// agents read, and a 404 there makes the identity useless.
const probe = await fetch(AGENT_URI).catch(() => null)
if (!probe?.ok) {
  console.error(`✗ agentURI does not resolve: ${AGENT_URI} (${probe?.status ?? 'unreachable'})`)
  console.error('  Deploy the /.well-known/agent.json route first.')
  process.exit(1)
}
console.log(`✓ agentURI resolves: ${AGENT_URI}`)

const key = process.env.AGENT_OWNER_PRIVATE_KEY
if (!key) {
  console.error('✗ AGENT_OWNER_PRIVATE_KEY is not set — cannot simulate or send.')
  process.exit(2)
}
const account = privateKeyToAccount(key.startsWith('0x') ? key : `0x${key}`)

const balance = await publicClient.getBalance({ address: account.address })
console.log(`  owner:   ${account.address}`)
console.log(`  balance: ${Number(balance) / 1e18} CELO`)

const { request, result } = await publicClient.simulateContract({
  account,
  address: IDENTITY_REGISTRY,
  abi: ABI,
  functionName: 'register',
  args: [AGENT_URI],
})
console.log(`  would mint agentId: ${result}`)

if (!SEND) {
  console.log('\nDry run. Re-run with --send to mint for real.')
  process.exit(0)
}

const wallet = createWalletClient({ account, chain: celo, transport: http(process.env.CELO_RPC_URL || 'https://forno.celo.org') })
const hash = await wallet.writeContract(request)
console.log(`\nsent: ${hash}`)
const receipt = await publicClient.waitForTransactionReceipt({ hash })

let agentId
for (const log of receipt.logs) {
  try {
    const d = decodeEventLog({ abi: ABI, data: log.data, topics: log.topics })
    if (d.eventName === 'Transfer') agentId = d.args.tokenId
  } catch { /* log from another contract */ }
}
console.log(`status:  ${receipt.status}`)
console.log(`AGENT ID: ${agentId ?? result}`)
console.log(`\nSet NEXT_PUBLIC_AGENT_ID=${agentId ?? result} in Vercel, then redeploy.`)
