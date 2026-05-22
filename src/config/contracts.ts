// config/contracts.ts

export const CELO_CONTRACTS = {
  token: process.env.NEXT_PUBLIC_CELO_TOKEN ?? '0xE370aad742dF8DC8Ae9c0F0b9f265334D39e2197',
  game: process.env.NEXT_PUBLIC_CELO_GAME ?? '0xf85f00D39A84b5180390548Ea9f76B0458607E78',
} as const

export const CELO_CHAIN_ID = 42220 // Celo Mainnet

export const TOKEN_DECIMALS  = 6
export const FAUCET_AMOUNT   = 1_000_000_000n  // 1000 CHESS
export const FAUCET_COOLDOWN = 144             // ~1 day in blocks
export const BLOCK_TIME_SECS = 600
