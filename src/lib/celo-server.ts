import {
  createPublicClient,
  createWalletClient,
  http,
  getAddress,
  type Address,
  type Hash,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, celoAlfajores } from 'viem/chains'
import { CHESS_GAME_ABI, CHESS_TOKEN_ABI } from '@/config/abis'
import { CELO_CONTRACTS } from '@/config/contracts'

// Server-only viem clients + signing wallets for Chessify on Celo.
// NEVER import this from client components — it reads private keys.
//
// Wallet roles (kept as separate env vars for split/rotation; may share one key initially):
//   ORACLE_PRIVATE_KEY      — calls settleGame (declares winner/draw)
//   MINTER_PRIVATE_KEY      — calls token.mintTo (provisions CHESS to MiniPay wallets)
//   GAS_SPONSOR_PRIVATE_KEY — drips USDm gas to 0-balance MiniPay EOAs
// All three hold CELO, so their own txs pay gas natively (no feeCurrency).

// ── Contract result enum (mirrors ChessGame.GameResult) ──────────────────────
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
  createdAt: bigint
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
    drawProposer: Address
  }
  return {
    white: g.white,
    black: g.black,
    wager: g.wager,
    status: g.status as GameStatus,
    result: g.result as GameResult,
    createdAt: g.createdAt,
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

// A game's on-chain `createdAt` is the **block number** it was created in, not a
// timestamp. Build a mapper from a block number to an estimated unix time (secs)
// by measuring the current block time from two spaced reference blocks. Accurate
// to seconds over recent history — enough for history dates and season windows.
export async function getBlockToTimeMapper(): Promise<(block: number) => number> {
  const pub = getPublicClient()
  const latest = await pub.getBlock()
  const L = Number(latest.number)
  const tL = Number(latest.timestamp)
  const olderNum = Math.max(0, L - 2_000_000)
  const older = await pub.getBlock({ blockNumber: BigInt(olderNum) })
  const O = Number(older.number)
  const tO = Number(older.timestamp)
  const blockTime = O < L ? (tL - tO) / (L - O) : 5 // secs/block; Celo fallback
  return (block: number) => Math.round(tL - (L - block) * blockTime)
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

export { GAME_ADDRESS, TOKEN_ADDRESS, getAddress }
export type { Address }
