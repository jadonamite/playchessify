// config/contracts.ts

/** Live mainnet handover stack — README + production Vercel env target. */
export const CELO_MAINNET_HANDOVER = {
  token: '0x3f7efdfc8a76f76f22512fcd2bddc5fca36e55a3',
  game: '0xb37877a9ebd6c3169b2eaaa3e16852839785ae85',
} as const

/** Pre-oracle v2 mainnet (legacy default when env unset). */
const CELO_MAINNET_V2 = {
  token: '0x607590fC7ba3F17b6B3274fF281528a131E9b015',
  game: '0xA576321eB523FFb1e5FE568b317F9E7a7374fDdf',
} as const

// Env-selectable so we can rehearse on Alfajores before mainnet.
const IS_TESTNET = process.env.NEXT_PUBLIC_CELO_NETWORK === 'alfajores'

export const CELO_CONTRACTS = {
  token:
    process.env.NEXT_PUBLIC_CELO_TOKEN ??
    (IS_TESTNET ? CELO_MAINNET_V2.token : CELO_MAINNET_HANDOVER.token),
  game:
    process.env.NEXT_PUBLIC_CELO_GAME ??
    (IS_TESTNET ? CELO_MAINNET_V2.game : CELO_MAINNET_HANDOVER.game),
  // v2: OpenZeppelin ERC2771Forwarder — gasless meta-txs for Tier C EOAs.
  forwarder: process.env.NEXT_PUBLIC_CELO_FORWARDER ?? '0xd29618312668007d1Da3B9eB591B7209E1A06cC5',
  // Weekly Grand Prix prize vault — owner seeds each concluded season's winners,
  // winners pull their USDm prize (2771-aware, so gasless claims ride the relay).
  rewards: process.env.NEXT_PUBLIC_CELO_REWARDS ?? '0xd867C2467c41Ccbe315eF4fFa3B9eBFa0C2D8d24',
} as const

export const CELO_CHAIN_ID = IS_TESTNET ? 44787 : 42220 // Alfajores | Celo Mainnet

// USDm (Mento Dollar — the cUSD rebrand: same contract, same 18 decimals) — the
// only fee currency MiniPay supports for gasless (legacy) txns.
export const USDM_ADDRESS = (process.env.NEXT_PUBLIC_FEE_CURRENCY ??
  (IS_TESTNET
    ? '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1' // Alfajores USDm
    : '0x765DE816845861e75A25fCA122bb6898B8B1282a') // Mainnet USDm
) as `0x${string}`

export const TOKEN_DECIMALS  = 6
export const FAUCET_AMOUNT   = 1_000_000_000n  // 1000 CHESS
export const FAUCET_COOLDOWN = 86_400          // seconds — PlaychessifyToken v2 cooldown is timestamp-based
export const JOIN_WINDOW_SECS = 600            // 10 min — matches PlaychessifyEngine.JOIN_WINDOW
