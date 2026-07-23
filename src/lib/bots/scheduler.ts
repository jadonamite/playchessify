import type { Abi } from 'viem'
import { parseUnits } from 'viem'
import { BOTS, isBotAddress, BOT_MAX_OPEN_LOBBIES, BOT_MIN_WAGER, type BotProfile } from '@/config/bots'
import {
  acquireTickLock,
  countPairingOnce,
  getBotGameIds,
  humanUnderBotCap,
  registerBotGame,
  unregisterBotGame,
} from '@/lib/bots/state'
import { botClaimFaucetIfDue, botCreateGame, botEnsureAllowance, botJoinGame } from '@/lib/bots/actions'
import { botPlayTurn } from '@/lib/bots/play'
import { getPublicClient, GameStatus, chessBalanceOf } from '@/lib/celo-server'
import { CELO_CONTRACTS, JOIN_WINDOW_SECS, TOKEN_DECIMALS } from '@/config/contracts'
import { CHESS_GAME_ABI } from '@/config/abis'

const LOG_PREFIX = '[bots/scheduler]'
const GAME = CELO_CONTRACTS.game as `0x${string}`

// The tick is traffic-driven (fired via after() from busy API routes, plus the
// cron backstop), so the lock interval is the fleet's minimum heartbeat. Keeping
// it coarse makes bot activity feel organic instead of metronomic.
const TICK_LOCK_SECONDS = 45

// How far back the lobby scan looks. Lobbies die after 10 minutes, so anything
// interesting is always near the head of the game list.
const LOBBY_SCAN_DEPTH = 14
// Don't join a lobby that could expire mid-join, and don't snap up brand-new
// ones instantly — a real player takes a moment to notice a game.
const JOIN_MIN_AGE_S = 45
const JOIN_MAX_AGE_S = JOIN_WINDOW_SECS - 90

// Per-tick action probabilities. Ticks fire at most every TICK_LOCK_SECONDS, so
// these translate to "a bot reacts within a few minutes", not "every time".
const JOIN_CHANCE = 0.45
const CREATE_CHANCE = 0.35
const MAX_FAUCET_CLAIMS_PER_TICK = 2

// Wager menu for bot-created lobbies, floored at BOT_MIN_WAGER and weighted
// toward the entry stake.
const CREATE_WAGERS = [100, 100, 100, 150, 150, 200, 250]

interface RecentGame {
  id: number
  white: string
  wager: bigint
  status: number
  createdAt: number
}

async function recentGames(): Promise<RecentGame[]> {
  const pub = getPublicClient()
  const nonce = (await pub.readContract({ address: GAME, abi: CHESS_GAME_ABI as Abi, functionName: 'gameNonce' })) as bigint
  const lastId = Number(nonce) - 1
  if (lastId < 0) return []
  const ids: bigint[] = []
  for (let i = lastId; i >= Math.max(0, lastId - LOBBY_SCAN_DEPTH + 1); i--) ids.push(BigInt(i))
  const results = await pub.multicall({
    contracts: ids.map((id) => ({ address: GAME, abi: CHESS_GAME_ABI as Abi, functionName: 'getGame', args: [id] })),
    allowFailure: true,
  })
  const games: RecentGame[] = []
  results.forEach((r, i) => {
    if (r.status !== 'success') return
    const g = r.result as { white: string; wager: bigint; status: number; createdAt: bigint }
    games.push({ id: Number(ids[i]), white: g.white, wager: g.wager, status: Number(g.status), createdAt: Number(g.createdAt) })
  })
  return games
}

function pickRandom<T>(items: T[]): T | null {
  return items.length === 0 ? null : items[Math.floor(Math.random() * items.length)]
}

/** Bots able to stake `wager` from their own balance (and willing, per persona cap). */
async function botsAffording(wager: bigint): Promise<BotProfile[]> {
  const balances = await Promise.all(BOTS.map((b) => chessBalanceOf(b.address).catch(() => 0n)))
  return BOTS.filter((b, i) => {
    const cap = parseUnits(String(b.maxWager), TOKEN_DECIMALS)
    return balances[i] >= wager && cap >= wager
  })
}

/** Sweep every game the fleet is in: count fresh pairings, play due turns, drop settled ones. */
async function sweepBotGames(): Promise<void> {
  const ids = await getBotGameIds()
  for (const gameId of ids.sort((a, b) => b - a).slice(0, 20)) {
    try {
      const pub = getPublicClient()
      const g = (await pub.readContract({
        address: GAME, abi: CHESS_GAME_ABI as Abi, functionName: 'getGame', args: [BigInt(gameId)],
      })) as { white: string; black: string; status: number; createdAt: bigint }
      const status = Number(g.status)

      if (status === GameStatus.Waiting) {
        // Expired lobbies leave the sweep set; the lifecycle sweep refunds escrow.
        const expired = Date.now() / 1000 - Number(g.createdAt) > JOIN_WINDOW_SECS + 60
        if (expired) await unregisterBotGame(gameId)
        continue
      }
      if (status !== GameStatus.Active) {
        await unregisterBotGame(gameId)
        continue
      }

      // Active: the non-bot side is the human this pairing counts against.
      const human = isBotAddress(g.white) ? g.black : g.white
      if (!isBotAddress(human)) await countPairingOnce(gameId, human)
      await botPlayTurn(gameId)
    } catch (err) {
      console.error(`${LOG_PREFIX} sweep failed`, { gameId, err: (err as Error)?.message })
    }
  }
}

/** Claim due faucets so the fleet always has tomorrow's bankroll. */
async function claimFaucets(): Promise<void> {
  let claims = 0
  for (const bot of BOTS) {
    if (claims >= MAX_FAUCET_CLAIMS_PER_TICK) return
    try {
      if (await botClaimFaucetIfDue(bot)) claims++
    } catch (err) {
      console.error(`${LOG_PREFIX} faucet claim failed`, { bot: bot.name, err: (err as Error)?.message })
    }
  }
}

/** Maybe join one open human lobby (cap-aware, randomized). */
async function maybeJoin(recent: RecentGame[]): Promise<void> {
  if (Math.random() > JOIN_CHANCE) return
  const nowS = Date.now() / 1000
  const minWager = parseUnits(String(BOT_MIN_WAGER), TOKEN_DECIMALS)
  const candidates = recent.filter((g) => {
    if (g.status !== GameStatus.Waiting || isBotAddress(g.white)) return false
    if (g.wager < minWager) return false // bots never stake below the floor
    const age = nowS - g.createdAt
    return age >= JOIN_MIN_AGE_S && age <= JOIN_MAX_AGE_S
  })
  const target = pickRandom(candidates)
  if (!target) return
  if (!(await humanUnderBotCap(target.white))) return

  const bot = pickRandom(await botsAffording(target.wager))
  if (!bot) return
  try {
    if (target.wager > 0n) await botEnsureAllowance(bot)
    await botJoinGame(bot, target.id)
    await registerBotGame(target.id)
    await countPairingOnce(target.id, target.white)
    console.info(`${LOG_PREFIX} joined lobby`, { gameId: target.id, bot: bot.name })
    // The bot plays black; if white opens it replies on the next trigger. If the
    // board is empty white is the human, so nothing to do yet.
  } catch (err) {
    console.error(`${LOG_PREFIX} join failed`, { gameId: target.id, bot: bot.name, err: (err as Error)?.message })
  }
}

/** Maybe open one lobby of our own, holding the fleet under its visible-lobby cap. */
async function maybeCreate(recent: RecentGame[]): Promise<void> {
  if (Math.random() > CREATE_CHANCE) return
  const nowS = Date.now() / 1000
  const liveBotLobbies = recent.filter(
    (g) => g.status === GameStatus.Waiting && isBotAddress(g.white) && nowS - g.createdAt <= JOIN_WINDOW_SECS,
  ).length
  if (liveBotLobbies >= BOT_MAX_OPEN_LOBBIES) return

  const wagerWhole = pickRandom(CREATE_WAGERS) ?? 0
  const wager = parseUnits(String(wagerWhole), TOKEN_DECIMALS)
  const bot = pickRandom(await botsAffording(wager))
  if (!bot) return
  try {
    if (wager > 0n) await botEnsureAllowance(bot)
    const gameId = await botCreateGame(bot, wager)
    await registerBotGame(gameId)
    console.info(`${LOG_PREFIX} opened lobby`, { gameId, bot: bot.name, wager: wagerWhole })
  } catch (err) {
    console.error(`${LOG_PREFIX} create failed`, { bot: bot.name, err: (err as Error)?.message })
  }
}

/**
 * One fleet heartbeat. Cheap no-op when another tick holds the lock or the
 * fleet isn't configured. Never throws — this runs piggybacked (via after())
 * on user-facing requests and must not affect them.
 */
export async function maybeTickBots(): Promise<void> {
  try {
    if (!process.env.BOT_MNEMONIC) return
    if (!(await acquireTickLock(TICK_LOCK_SECONDS))) return

    await sweepBotGames()
    await claimFaucets()
    const recent = await recentGames()
    await maybeJoin(recent)
    await maybeCreate(recent)
  } catch (err) {
    console.error(`${LOG_PREFIX} tick failed`, (err as Error)?.message)
  }
}

/** Fast path for one game: give the bot 2–8s of "thinking", then move. */
export async function botRespondSoon(gameId: number): Promise<void> {
  const delay = 2000 + Math.floor(Math.random() * 6000)
  await new Promise((r) => setTimeout(r, delay))
  try {
    await botPlayTurn(gameId)
  } catch (err) {
    console.error(`${LOG_PREFIX} respond failed`, { gameId, err: (err as Error)?.message })
  }
}
