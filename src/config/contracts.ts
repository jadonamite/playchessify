// config/contracts.ts

export const CELO_CONTRACTS = {
  token: process.env.NEXT_PUBLIC_CELO_TOKEN ?? '0xE370aad742dF8DC8Ae9c0F0b9f265334D39e2197',
  game: process.env.NEXT_PUBLIC_CELO_GAME ?? '0xf85f00D39A84b5180390548Ea9f76B0458607E78',
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
export const FAUCET_COOLDOWN = 17_280          // ~1 day on Celo (matches ChessToken.FAUCET_COOLDOWN)
export const BLOCK_TIME_SECS = 5               // Celo block time
