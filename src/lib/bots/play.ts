import { Chess } from 'chess.js'
import { getBotByAddress, type BotProfile } from '@/config/bots'
import { getBotAccount } from '@/lib/bots/wallets'
import { registerBotGame, unregisterBotGame } from '@/lib/bots/state'
import { appendMove, getMoves, registerActiveGame, type Chain, type MoveRecord } from '@/lib/moves-store'
import { getOnchainGame, GameStatus, type OnchainGame } from '@/lib/celo-server'
import { canonicalMoveMessage, deriveResult, MOVE_TIMEOUT_MS } from '@/lib/settlement'
import { getCoachMove, getBestMove } from '@/lib/chess-engine'
import { settleGameById } from '@/lib/settle-game'

const LOG_PREFIX = '[bots/play]'
const CHAIN: Chain = 'celo'

/** The bot participating in a game, if any (bots never face each other). */
export function botInGame(game: Pick<OnchainGame, 'white' | 'black'>): BotProfile | null {
  return getBotByAddress(game.white) ?? getBotByAddress(game.black) ?? null
}

/**
 * Play the bot's move in `gameId` if — and only if — it is actually the bot's
 * turn right now. Safe to call redundantly: it re-derives everything from the
 * on-chain game and the relay history, and the relay's atomic slot-append means
 * a duplicate invocation loses the race harmlessly.
 */
export async function botPlayTurn(gameId: number): Promise<boolean> {
  const game = await getOnchainGame(gameId)
  if (game.status !== GameStatus.Active) {
    if (game.status !== GameStatus.Waiting) await unregisterBotGame(gameId)
    return false
  }

  const bot = botInGame(game)
  if (!bot) return false
  await registerBotGame(gameId) // covers bot lobbies a human just joined

  const existing = await getMoves(CHAIN, gameId)
  if (existing.length > 0 && Date.now() - existing[existing.length - 1].ts > MOVE_TIMEOUT_MS) {
    return false
  }

  const board = new Chess()
  for (const m of existing) {
    try {
      if (!board.move(m.san)) throw new Error('bad history')
    } catch {
      console.error(`${LOG_PREFIX} corrupt history`, { gameId })
      return false
    }
  }

  const standing = deriveResult(existing, game.white, game.black)
  if (standing.kind === 'result') {
    try {
      await settleGameById(CHAIN, gameId)
      await unregisterBotGame(gameId)
    } catch (err) {
      console.error(`${LOG_PREFIX} settle of terminal game failed`, { gameId, err: (err as Error)?.message })
    }
    return false
  }

  const sideToMove = board.turn() === 'w' ? game.white : game.black
  if (sideToMove.toLowerCase() !== bot.address.toLowerCase()) return false

  const chosen = getCoachMove(board, bot.engine) ?? getBestMove(board, bot.engine.depth)
  if (!chosen) return false

  board.move(chosen.san)
  const fen = board.fen()
  const moveNumber = existing.length + 1

  // Bots are signing EOAs (Tier C): sign every move so settlement's
  // signature re-verification covers bot games end to end.
  const account = getBotAccount(bot)
  const sig = await account.signMessage({
    message: canonicalMoveMessage({ chain: CHAIN, gameId, moveNumber, san: chosen.san, fen }),
  })

  const record: MoveRecord = {
    san: chosen.san,
    player: bot.address,
    moveNumber,
    ts: Date.now(),
    sig,
    signer: bot.address,
  }
  const newLen = await appendMove(CHAIN, gameId, record, existing.length)
  if (newLen === null) return false // lost the slot race — a resync will retry us

  await registerActiveGame(CHAIN, gameId)

  const terminal = deriveResult([...existing, record], game.white, game.black)
  if (terminal.kind === 'result') {
    try {
      await settleGameById(CHAIN, gameId)
      await unregisterBotGame(gameId)
    } catch (err) {
      console.error(`${LOG_PREFIX} settle after terminal move failed`, { gameId, err: (err as Error)?.message })
    }
  }
  return true
}