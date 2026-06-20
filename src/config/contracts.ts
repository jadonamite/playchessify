export const getChainId = (network: string | undefined): number => network === 'alfajores' ? 44787 : 42220;
export const getUsdmAddress = (network: string | undefined, testnetAddress: string, mainnetAddress: string): string => network === 'alfajores' ? testnetAddress : mainnetAddress;

export const CELO_CONTRACTS = {
  token: process.env.NEXT_PUBLIC_CELO_TOKEN ?? '0xE370aad742dF8DC8Ae9c0F0b9f265334D39e2197',
  game: process.env.NEXT_PUBLIC_CELO_GAME ?? '0xf85f00D39A84b5180390548Ea9f76B0458607E78',
} as const;

const IS_TESTNET = process.env.NEXT_PUBLIC_CELO_NETWORK === 'alfajores';
export const CELO_CHAIN_ID = getChainId(process.env.NEXT_PUBLIC_CELO_NETWORK);
export const USDM_ADDRESS = getUsdmAddress(process.env.NEXT_PUBLIC_CELO_NETWORK, '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1', '0x765DE816845861e75A25fCA122bb6898B8B1282a');
export const TOKEN_DECIMALS = 6;
export const FAUCET_AMOUNT = 1_000_000_000n;
export const FAUCET_COOLDOWN = 17_280;
export const BLOCK_TIME_SECS = 5;