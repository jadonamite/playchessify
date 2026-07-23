// config/bots.ts
//
// are derived server-side from BOT_MNEMONIC (HD index = BotProfile.index) and
// asserted against these addresses, so the roster here is the single source of
// truth for "is this address a bot".
//
// Bots are ordinary on-chain players: they claim the daily faucet, escrow real
// CHESS wagers, and appear in the lobby like anyone else — the UI's only tell
// is the small "automated" mark on their open-game badge.

import type { CoachEngine } from '@/config/coaches'

export interface BotProfile {
  /** HD derivation index under BOT_MNEMONIC. */
  index: number
  address: `0x${string}`
  /** Display handle — reads like a normal player username. */
  name: string
  /** Persona strength the engine params are tuned toward (not the on-chain Elo). */
  targetRating: number
  /** Move selection — same knobs as the coach engine (depth/topK/temperature/style). */
  engine: CoachEngine
  /** Largest wager (whole CHESS) this bot will create or match. */
  maxWager: number
}

export const BOTS: BotProfile[] = [
  { index: 0,  address: '0xE0B1798916E6026675f33FE5aAfA0C203B77856d', name: 'ade_moves',   targetRating: 600,  maxWager: 100,
    engine: { depth: 1, topK: 5, temperature: 0.9,  style: { kingAttack: 0.4, sacrifice: 0.5, positional: 0.2, simplify: 0.3, forcing: 0.5 } } },
  { index: 1,  address: '0xb6eB9444a4994a8295bd8EA626ce7672C174cec3', name: 'chiomaq',     targetRating: 700,  maxWager: 100,
    engine: { depth: 1, topK: 4, temperature: 0.75, style: { kingAttack: 0.5, sacrifice: 0.4, positional: 0.3, simplify: 0.3, forcing: 0.6 } } },
  { index: 2,  address: '0xC9d73B644b788A7cC30A5C3eD3c82e168510d0F4', name: 'kwame_k',     targetRating: 800,  maxWager: 100,
    engine: { depth: 2, topK: 5, temperature: 0.7,  style: { kingAttack: 0.6, sacrifice: 0.6, positional: 0.3, simplify: 0.3, forcing: 0.6 } } },
  { index: 3,  address: '0x4B4c90fCD03F0C60a069e7Afe2C465dC4FdB8517', name: 'tunde2x',     targetRating: 900,  maxWager: 100,
    engine: { depth: 2, topK: 4, temperature: 0.6,  style: { kingAttack: 0.7, sacrifice: 0.6, positional: 0.4, simplify: 0.3, forcing: 0.7 } } },
  { index: 4,  address: '0x813a1bcb46957feE05c8558392CaA28C9B539138', name: 'amara.eth',   targetRating: 1000, maxWager: 100,
    engine: { depth: 2, topK: 4, temperature: 0.5,  style: { kingAttack: 0.5, sacrifice: 0.4, positional: 0.5, simplify: 0.4, forcing: 0.6 } } },
  { index: 5,  address: '0x60AF506797Bc594B97b24CFEc15Bc9ce35bbFbf1', name: 'blitzsegun',  targetRating: 1100, maxWager: 100,
    engine: { depth: 2, topK: 3, temperature: 0.45, style: { kingAttack: 0.8, sacrifice: 0.7, positional: 0.4, simplify: 0.3, forcing: 0.8 } } },
  { index: 6,  address: '0x0C959FB88611331F41BF7649e584856194aD339b', name: 'nia_w',       targetRating: 1200, maxWager: 150,
    engine: { depth: 2, topK: 3, temperature: 0.35, style: { kingAttack: 0.5, sacrifice: 0.4, positional: 0.7, simplify: 0.5, forcing: 0.55 } } },
  { index: 7,  address: '0xAFda7a0158A19D2de3E8fc978ff597AE8E82eC41', name: 'obi_wan_c',   targetRating: 1300, maxWager: 150,
    engine: { depth: 3, topK: 3, temperature: 0.35, style: { kingAttack: 0.6, sacrifice: 0.5, positional: 0.6, simplify: 0.4, forcing: 0.7 } } },
  { index: 8,  address: '0xb06Bd029203ACA8C79268EA550000E3aFD7437ce', name: 'zeezee_243',  targetRating: 1400, maxWager: 200,
    engine: { depth: 3, topK: 2, temperature: 0.3,  style: { kingAttack: 0.85, sacrifice: 0.8, positional: 0.4, simplify: 0.3, forcing: 0.85 } } },
  { index: 9,  address: '0x8137677b4Af63176345bC7Fff632473c080C58Cb', name: 'femi_grinds', targetRating: 1500, maxWager: 200,
    engine: { depth: 3, topK: 2, temperature: 0.2,  style: { kingAttack: 0.4, sacrifice: 0.3, positional: 0.9, simplify: 0.8, forcing: 0.45 } } },
  { index: 10, address: '0xE8f4f30a8569b3c6EfeCD096ce9BDDF2d682C65A', name: 'msq_khadija', targetRating: 1650, maxWager: 250,
    engine: { depth: 3, topK: 2, temperature: 0.15, style: { kingAttack: 0.6, sacrifice: 0.45, positional: 0.8, simplify: 0.5, forcing: 0.75 } } },
  { index: 11, address: '0xFD7511e688Ba15a5a5D00026376bC7EdAA22E681', name: 'don_p_chess', targetRating: 1800, maxWager: 250,
    engine: { depth: 3, topK: 1, temperature: 0.05, style: { kingAttack: 0.7, sacrifice: 0.5, positional: 0.8, simplify: 0.6, forcing: 0.8 } } },
]

const BOT_ADDRESS_SET = new Set(BOTS.map((b) => b.address.toLowerCase()))

export function isBotAddress(address: string | null | undefined): boolean {
  return !!address && BOT_ADDRESS_SET.has(address.toLowerCase())
}

export function getBotByAddress(address: string): BotProfile | undefined {
  return BOTS.find((b) => b.address.toLowerCase() === address.toLowerCase())
}

/** Max bot games (either side) a real player is paired into per UTC day. */
export const BOT_DAILY_HUMAN_CAP = 4

/** Bots never stake below this (whole CHESS) — creating or joining. */
export const BOT_MIN_WAGER = 100

/** Target number of bot-created lobbies live at once. */
export const BOT_MAX_OPEN_LOBBIES = 2
