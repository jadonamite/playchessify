import { encodeFunctionData, decodeEventLog, parseUnits, type Address, type Hash } from 'viem'
import { CHESS_GAME_ABI, CHESS_TOKEN_ABI, FORWARDER_ABI } from '@/config/abis'
import { CELO_CONTRACTS, TOKEN_DECIMALS } from '@/config/contracts'
import { forwarderDomain, FORWARD_REQUEST_TYPES, buildForwardRequestMessage } from '@/lib/meta-tx'
import { getPublicClient, executeForwardRequest } from '@/lib/celo-server'
import type { BotProfile } from '@/config/bots'
import { getBotAccount } from '@/lib/bots/wallets'

// Server-only on-chain actions for the bot fleet. Bots ride the exact same
// ERC-2771 rail as Tier C players: the bot key signs a ForwardRequest and the
// gas-sponsor executes it, so bot wallets hold CHESS but never need gas.

const GAME = CELO_CONTRACTS.game as Address
const TOKEN = CELO_CONTRACTS.token as Address
const FORWARDER = CELO_CONTRACTS.forwarder as Address

// Mirrors the client's finite-but-large approval so repeat games skip approve.
const BOT_APPROVAL = parseUnits('1000000', TOKEN_DECIMALS)
// Re-approve once the remaining allowance can't cover a max-size wager stack.
const ALLOWANCE_FLOOR = parseUnits('1000', TOKEN_DECIMALS)

// Forno is load-balanced, so a nonce read right after a confirmed meta-tx can
// hit a lagging node and come back stale — the forwarder then rejects the
// signature as ERC2771ForwarderInvalidSigner. Track the next nonce we've used
// per bot within this instance and never sign below it.
const nextNonce = new Map<string, bigint>()

function getNextNonce(bot: BotProfile): bigint {
  const account = getBotAccount(bot)
  const onchain = (getPublicClient().readContract({
    address: FORWARDER,
    abi: FORWARDER_ABI,
    functionName: 'nonces',
    args: [account.address],
  }) as Promise<bigint>)
  const tracked = nextNonce.get(bot.address) ?? 0n
  return Promise.all([onchain]).then(([onchainNonce]) => onchainNonce > tracked ? onchainNonce : tracked)
}

async function botMetaTx(bot: BotProfile, to: Address, data: `0x${string}`): Promise<Hash> {
  const nonce = await getNextNonce(bot)
  const message = buildForwardRequestMessage({ from: getBotAccount(bot).address, to, data, nonce })
  const signature = await getBotAccount(bot).signTypedData({
    domain: forwarderDomain(),
    types: FORWARD_REQUEST_TYPES,
    primaryType: 'ForwardRequest',
    message,
  })

  const hash = await executeForwardRequest({
    from: message.from,
    to: message.to,
    value: message.value,
    gas: message.gas,
    deadline: message.deadline,
    data: message.data,
    signature,
  })
  nextNonce.set(bot.address, nonce + 1n)
  return hash
}

/** Claim the daily faucet if the cooldown has elapsed. Returns whether a claim ran. */
export async function botClaimFaucetIfDue(bot: BotProfile): Promise<boolean> {
  const remaining = (await getPublicClient().readContract({
    address: TOKEN,
    abi: CHESS_TOKEN_ABI,
    functionName: 'faucetCooldownRemaining',
    args: [bot.address],
  })) as bigint
  if (remaining > 0n) return false
  await botMetaTx(bot, TOKEN, encodeFunctionData({ abi: CHESS_TOKEN_ABI, functionName: 'faucetClaim' }))
  return true
}

/** Ensure the engine can pull wagers from this bot; approves lazily. */
export async function botEnsureAllowance(bot: BotProfile): Promise<void> {
  const allowance = (await getPublicClient().readContract({
    address: TOKEN,
    abi: CHESS_TOKEN_ABI,
    functionName: 'allowance',
    args: [bot.address, GAME],
  })) as bigint
  if (allowance >= ALLOWANCE_FLOOR) return
  await botMetaTx(
    bot,
    TOKEN,
    encodeFunctionData({ abi: CHESS_TOKEN_ABI, functionName: 'approve', args: [GAME, BOT_APPROVAL] }),
  )
}

/** Create an open lobby with `wager` (base units). Returns the new gameId. */
export async function botCreateGame(bot: BotProfile, wager: bigint): Promise<number> {
  const hash = await botMetaTx(
    bot,
    GAME,
    encodeFunctionData({ abi: CHESS_GAME_ABI, functionName: 'createGame', args: [wager] }),
  )
  const receipt = await getPublicClient().getTransactionReceipt({ hash })
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({ abi: CHESS_GAME_ABI, data: log.data, topics: log.topics })
      if (decoded.eventName === 'GameCreated') {
        return Number((decoded.args as unknown as { gameId: bigint }).gameId)
      }
    } catch {
      // log from another contract — skip
    }
  }
  throw new Error(`[bots] createGame: GameCreated event not found (${hash})`)
}

/** Join an open lobby as black. */
export async function botJoinGame(bot: BotProfile, gameId: number): Promise<Hash> {
  return botMetaTx(bot, GAME, encodeFunctionData({ abi: CHESS_GAME_ABI, functionName: 'joinGame', args: [BigInt(gameId)] }))
}

/** Resign a game the bot can no longer play (safety valve, not a strategy). */
export async function botResign(bot: BotProfile, gameId: number): Promise<Hash> {
  return botMetaTx(bot, GAME, encodeFunctionData({ abi: CHESS_GAME_ABI, functionName: 'resign', args: [BigInt(gameId)] }))
}