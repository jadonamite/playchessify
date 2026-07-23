import {
  createPublicClient,
  createWalletClient,
  http,
  getAddress,
  formatEther,
  parseEther,
  type Address,
  type Hash,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, celoAlfajores } from 'viem/chains'
import { CHESS_GAME_ABI, CHESS_TOKEN_ABI, FORWARDER_ABI } from '@/config/abis'
import { CELO_CONTRACTS } from '@/config/contracts'

// Server-only viem clients + signing wallets for Chessify on Celo.
// NEVER import this from client components — it reads private keys.
//
// Wallet roles (kept as separate env vars for split/rotation; may share one key initially):
//   ORACLE_PRIVATE_KEY      — calls settleGame (declares winner/draw)
//   MINTER_PRIVATE_KEY      — calls token.mintTo (provisions CHESS to MiniPay wallets)
//   GAS_SPONSOR_PRIVATE_KEY — drips USDm gas to 0-balance MiniPay EOAs
// All three hold CELO, so their own txs pay gas natively (no feeCurrency).

// ── Contract result enum (mirrors PlaychessifyEngine.GameResult) ──────────────────────
export enum GameResult {
  None = 0,
  WhiteWins = 1,
  BlackWins = 2,
  DrawResult = 3,
  Cancelled = 4,
}

export enum GameStatus {
  Waiting = 0,
  Active = 1,
  Finished = 2,
  Cancelled = 3,
  Draw = 4,
}

// ── Chain / network selection ────────────────────────────────────────────────
const IS_TESTNET = process.env.NEXT_PUBLIC_CELO_NETWORK === 'alfajores'
const CHAIN = IS_TESTNET ? celoAlfajores : celo
const RPC_URL = IS_TESTNET
  ? 'https://alfajores-forno.celo-testnet.org'
  : 'https://forno.celo.org'

const GAME_ADDRESS = CELO_CONTRACTS.game as Address
const TOKEN_ADDRESS = CELO_CONTRACTS.token as Address
const FORWARDER_ADDRESS = CELO_CONTRACTS.forwarder as Address

// ── Public client (reads) ────────────────────────────────────────────────────
function makePublicClient() {
  return createPublicClient({ chain: CHAIN, transport: http(RPC_URL) })
}
let _publicClient: ReturnType<typeof makePublicClient> | null = null
export function getPublicClient(): ReturnType<typeof makePublicClient> {
  if (!_publicClient) _publicClient = makePublicClient()
  return _publicClient
}

// ── Wallet clients (writes) ──────────────────────────────────────────────────
function requireKey(name: string): `0x${string}` {
  const raw = process.env[name]
  if (!raw) throw new Error(`[celo-server] ${name} must be set`)
  return (raw.startsWith('0x') ? raw : `0x${raw}`) as `0x${string}`
}

function walletFor(envName: string) {
  const account = privateKeyToAccount(requireKey(envName))
  const client = createWalletClient({ account, chain: CHAIN, transport: http(RPC_URL) })
  return { account, client }
}

// ── On-chain reads ───────────────────────────────────────────────────────────
export interface OnchainGame {
  white: Address
  black: Address
  wager: bigint
  status: GameStatus
  result: GameResult
  createdAt: bigint   // unix seconds (v2 contracts use timestamps, not block numbers)
  joinedAt: bigint    // unix seconds; 0n until an opponent joins
  drawProposer: Address
}

export async function getOnchainGame(gameId: number): Promise<OnchainGame> {
  const g = (await getPublicClient().readContract({
    address: GAME_ADDRESS,
    abi: CHESS_GAME_ABI,
    functionName: 'getGame',
    args: [BigInt(gameId)],
  })) as unknown as {
    white: Address
    black: Address
    wager: bigint
    status: number
    result: number
    createdAt: bigint
    joinedAt: bigint
    drawProposer: Address
  }
  return {
    white: g.white,
    black: g.black,
    wager: g.wager,
    status: g.status as GameStatus,
    result: g.result as GameResult,
    createdAt: g.createdAt,
    joinedAt: g.joinedAt,
    drawProposer: g.drawProposer,
  }
}

// Short-lived in-memory cache to coalesce the per-move on-chain reads the relay
// does (moves arrive seconds apart; status/players barely change in that window).
const _gameCache = new Map<number, { at: number; game: OnchainGame }>()
const GAME_CACHE_TTL_MS = 5_000

export async function getOnchainGameCached(gameId: number): Promise<OnchainGame> {
  const hit = _gameCache.get(gameId)
  if (hit && Date.now() - hit.at < GAME_CACHE_TTL_MS) return hit.game
  const game = await getOnchainGame(gameId)
  _gameCache.set(gameId, { at: Date.now(), game })
  return game
}

/** Verify a wallet signature over an arbitrary message. Handles EOAs and, via
 *  EIP-1271, ERC-4337 smart accounts (Tier A). */
export async function verifyWalletSignature(
  signer: Address,
  message: string,
  signature: `0x${string}`,
): Promise<boolean> {
  try {
    return await getPublicClient().verifyMessage({ address: signer, message, signature })
  } catch {
    return false
  }
}

// ── On-chain writes ──────────────────────────────────────────────────────────

/** Oracle settles a game to its terminal result. Waits for the receipt. */
export async function settleOnChain(gameId: number, result: GameResult): Promise<Hash> {
  const { account, client } = walletFor('ORACLE_PRIVATE_KEY')
  const hash = await client.writeContract({
    account,
    chain: CHAIN,
    address: GAME_ADDRESS,
    abi: CHESS_GAME_ABI,
    functionName: 'settleGame',
    args: [BigInt(gameId), result],
  })
  await getPublicClient().waitForTransactionReceipt({ hash })
  return hash
}

/** Oracle voids a joined game in which no move was ever made — both wagers
 *  refunded, no winner, no Elo. Reverts until VOID_MIN_IDLE has passed. */
export async function voidOnChain(gameId: number): Promise<Hash> {
  const { account, client } = walletFor('ORACLE_PRIVATE_KEY')
  const hash = await client.writeContract({
    account,
    chain: CHAIN,
    address: GAME_ADDRESS,
    abi: CHESS_GAME_ABI,
    functionName: 'voidGame',
    args: [BigInt(gameId)],
  })
  await getPublicClient().waitForTransactionReceipt({ hash })
  return hash
}

/** Close a Waiting lobby whose 10-minute join window has expired. Permissionless
 *  on-chain (refund is hard-wired to the creator); the oracle key sweeps it. */
export async function closeStaleOnChain(gameId: number): Promise<Hash> {
  const { account, client } = walletFor('ORACLE_PRIVATE_KEY')
  const hash = await client.writeContract({
    account,
    chain: CHAIN,
    address: GAME_ADDRESS,
    abi: CHESS_GAME_ABI,
    functionName: 'closeStaleGame',
    args: [BigInt(gameId)],
  })
  await getPublicClient().waitForTransactionReceipt({ hash })
  return hash
}

// ── ERC-2771 meta-tx execution (Tier C gasless) ──────────────────────────────

export interface ForwardRequestData {
  from: Address
  to: Address
  value: bigint
  gas: bigint
  deadline: number
  data: `0x${string}`
  signature: `0x${string}`
}

/** Whether the forwarder accepts this request right now (signature, nonce,
 *  deadline). Read-only preflight so an invalid request never costs gas. */
export async function verifyForwardRequest(req: ForwardRequestData): Promise<boolean> {
  try {
    return (await getPublicClient().readContract({
      address: FORWARDER_ADDRESS,
      abi: FORWARDER_ABI,
      functionName: 'verify',
      args: [req],
    })) as boolean
  } catch {
    return false
  }
}

/** Execute a player-signed ForwardRequest through the trusted forwarder. The
 *  gas-sponsor wallet pays; the forwarder's signature check means executing a
 *  request grants us no authority over the player's game. */
export async function executeForwardRequest(req: ForwardRequestData): Promise<Hash> {
  const { account, client } = walletFor('GAS_SPONSOR_PRIVATE_KEY')
  const hash = await client.writeContract({
    account,
    chain: CHAIN,
    address: FORWARDER_ADDRESS,
    abi: FORWARDER_ABI,
    functionName: 'execute',
    args: [req],
  })
  await getPublicClient().waitForTransactionReceipt({ hash })
  return hash
}

// ── Oracle gas health (self-healing settlement) ──────────────────────────────
// The oracle pays native CELO for every settleGame tx. If it runs dry, every
// settlement silently reverts and finished games rot as "Active" (this bit us:
// games sat unsettled for ~2 weeks). Preflight the oracle before a sweep and, if
// low, auto-refill from a funded operator wallet — the same self-healing pattern
// the gas-sponsor already uses for player wallets. Operator→operator only.

const ORACLE_MIN_CELO = parseEther('0.2') // ~6 settlements of headroom
const ORACLE_TARGET_CELO = parseEther('1') // top up to here when refilling
const REFILL_RESERVE_CELO = parseEther('0.3') // never drain the source below this
const REFILL_SOURCE_ENV = 'MINTER_PRIVATE_KEY' // funded wallet that only mints occasionally

export interface OracleGasStatus {
  ok: boolean // oracle can afford at least one settlement
  balanceCelo: string
  refilled: boolean
  refillTx?: string
  note?: string
}

/** Ensure the oracle has gas to settle; auto-refill from an operator wallet if
 *  low. Never throws — a refill failure degrades to a reported `ok:false` so the
 *  caller (cron) can surface it rather than crash the whole sweep. */
export async function ensureOracleGas(): Promise<OracleGasStatus> {
  const pub = getPublicClient()
  try {
    const { account: oracle } = walletFor('ORACLE_PRIVATE_KEY')
    const balance = await pub.getBalance({ address: oracle.address })
    if (balance >= ORACLE_MIN_CELO) {
      return { ok: true, balanceCelo: formatEther(balance), refilled: false }
    }

    // Low — try one refill from the source wallet, keeping its reserve intact.
    const { account: src, client: srcClient } = walletFor(REFILL_SOURCE_ENV)
    const srcBalance = await pub.getBalance({ address: src.address })
    const need = ORACLE_TARGET_CELO - balance
    const spendable = srcBalance > REFILL_RESERVE_CELO ? srcBalance - REFILL_RESERVE_CELO : 0n
    const amount = need < spendable ? need : spendable

    if (amount <= 0n) {
      console.error('[celo-server] ORACLE LOW and refill source dry', {
        oracle: formatEther(balance),
        source: formatEther(srcBalance),
      })
      return {
        ok: false,
        balanceCelo: formatEther(balance),
        refilled: false,
        note: 'oracle low, refill source below reserve — MANUAL TOP-UP NEEDED',
      }
    }

    const hash = await srcClient.sendTransaction({ account: src, chain: CHAIN, to: oracle.address, value: amount })
    await pub.waitForTransactionReceipt({ hash })
    const after = await pub.getBalance({ address: oracle.address })
    console.info('[celo-server] oracle auto-refilled', { added: formatEther(amount), now: formatEther(after), tx: hash })
    return { ok: after >= ORACLE_MIN_CELO, balanceCelo: formatEther(after), refilled: true, refillTx: hash }
  } catch (err) {
    console.error('[celo-server] ensureOracleGas failed', (err as Error)?.message)
    return { ok: false, balanceCelo: 'unknown', refilled: false, note: (err as Error)?.message }
  }
}

/** Minter provisions CHESS to a recipient (e.g. a fresh MiniPay wallet). */
export async function mintChessTo(to: Address, amount: bigint): Promise<Hash> {
  const { account, client } = walletFor('MINTER_PRIVATE_KEY')
  const hash = await client.writeContract({
    account,
    chain: CHAIN,
    address: TOKEN_ADDRESS,
    abi: CHESS_TOKEN_ABI,
    functionName: 'mintTo',
    args: [to, amount],
  })
  await getPublicClient().waitForTransactionReceipt({ hash })
  return hash
}

/** Drip USDm gas money to a 0-balance MiniPay EOA so it can transact. */
export async function sponsorGas(to: Address, amountUsdm: bigint): Promise<Hash> {
  const { account, client } = walletFor('GAS_SPONSOR_PRIVATE_KEY')
  const hash = await client.writeContract({
    account,
    chain: CHAIN,
    address: USDM_ADDRESS,
    abi: ERC20_MIN_ABI,
    functionName: 'transfer',
    args: [to, amountUsdm],
  })
  await getPublicClient().waitForTransactionReceipt({ hash })
  return hash
}

/** Whether the gas-sponsor wallet can still cover a drip of `amountUsdm`
 *  (and has CELO for its own gas). Lets the API degrade gracefully to self-pay
 *  instead of failing when the faucet runs dry. */
export async function gasSponsorCanCover(amountUsdm: bigint): Promise<boolean> {
  try {
    const { account } = walletFor('GAS_SPONSOR_PRIVATE_KEY')
    const pub = getPublicClient()
    const [usdm, celo] = await Promise.all([
      pub.readContract({
        address: USDM_ADDRESS,
        abi: ERC20_MIN_ABI,
        functionName: 'balanceOf',
        args: [account.address],
      }) as Promise<bigint>,
      pub.getBalance({ address: account.address }),
    ])
    // Keep a small CELO floor so the sponsor can still pay for the transfer's gas.
    return usdm >= amountUsdm && celo > 1_000_000_000_000_000n // > 0.001 CELO
  } catch {
    return false
  }
}

/** Drip native CELO gas to a 0-balance external (Tier C) EOA so it can transact. */
export async function sponsorCelo(to: Address, amountCelo: bigint): Promise<Hash> {
  const { account, client } = walletFor('GAS_SPONSOR_PRIVATE_KEY')
  const hash = await client.sendTransaction({
    account,
    chain: CHAIN,
    to,
    value: amountCelo,
  })
  await getPublicClient().waitForTransactionReceipt({ hash })
  return hash
}

/** Whether the gas-sponsor wallet can still cover a CELO drip of `amountCelo`
 *  plus its own gas floor. */
export async function gasSponsorCanCoverCelo(amountCelo: bigint): Promise<boolean> {
  try {
    const { account } = walletFor('GAS_SPONSOR_PRIVATE_KEY')
    const celoBalance = await getPublicClient().getBalance({ address: account.address })
    // Keep a floor so the sponsor can still pay for its own transfer gas.
    return celoBalance > amountCelo + 1_000_000_000_000_000n // drip + > 0.001 CELO
  } catch {
    return false
  }
}

/** Current CELO balance of an address. */
export async function celoBalanceOf(addr: Address): Promise<bigint> {
  const result = getPublicClient().getBalance({ address: addr });
  return result;
}

/** Current CHESS balance of an address. */
export async function chessBalanceOf(addr: Address): Promise<bigint> {
  return (await getPublicClient().readContract({
    address: TOKEN_ADDRESS,
    abi: CHESS_TOKEN_ABI,
    functionName: 'balanceOf',
    args: [addr],
  })) as bigint
}

/** Current USDm balance of an address (fee-currency gas balance for MiniPay). */
export async function usdmBalanceOf(addr: Address): Promise<bigint> {
  return (await getPublicClient().readContract({
    address: USDM_ADDRESS,
    abi: ERC20_MIN_ABI,
    functionName: 'balanceOf',
    args: [addr],
  })) as bigint
}

// ── Constants ────────────────────────────────────────────────────────────────
// USDm (Mento Dollar — the cUSD rebrand: same contract, same 18 decimals).
// Gas fee currency on Celo. Mainnet default; override per network.
export const USDM_ADDRESS = getAddress(
  process.env.NEXT_PUBLIC_FEE_CURRENCY ??
    (IS_TESTNET
      ? '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1' // Alfajores USDm
      : '0x765DE816845861e75A25fCA122bb6898B8B1282a'), // Mainnet USDm
)

export const ERC20_MIN_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

export { GAME_ADDRESS, TOKEN_ADDRESS, FORWARDER_ADDRESS, getAddress }
export type { Address }
