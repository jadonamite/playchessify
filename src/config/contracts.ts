// config/contracts.ts

export const CELO_CONTRACTS = {
  token: process.env.NEXT_PUBLIC_CELO_TOKEN ?? '0x607590fC7ba3F17b6B3274fF281528a131E9b015',
  game: process.env.NEXT_PUBLIC_CELO_GAME ?? '0xA576321eB523FFb1e5FE568b317F9E7a7374fDdf',
  // v2: OpenZeppelin ERC2771Forwarder — gasless meta-txs for Tier C EOAs.
  forwarder: process.env.NEXT_PUBLIC_CELO_FORWARDER ?? '0xd29618312668007d1Da3B9eB591B7209E1A06cC5',
} as const

// Env-selectable so we can rehearse on Alfajores before mainnet.
const IS_TESTNET = process.env.NEXT_PUBLIC_CELO_NETWORK === 'alfajores'
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
