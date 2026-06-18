export const getChainConfig = (network: string) => {  const chainConfigs = {    alfajores: {      chainId: 44787,      usdmAddress: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1',    },    mainnet: {      chainId: 42220,      usdmAddress: '0x765DE816845861e75A25fCA122bb6898B8B1282a',    },  };  return chainConfigs[network];};

export const CELO_CONTRACTS = {
  token: process.env.NEXT_PUBLIC_CELO_TOKEN ?? '0xE370aad742dF8DC8Ae9c0F0b9f265334D39e2197',
  game: process.env.NEXT_PUBLIC_CELO_GAME ?? '0xf85f00D39A84b5180390548Ea9f76B0458607E78',
} as const;

const network = process.env.NEXT_PUBLIC_CELO_NETWORK;
const { chainId, usdmAddress } = getChainConfig(network ?? 'mainnet');
export const CELO_CHAIN_ID = chainId;
export const USDM_ADDRESS = usdmAddress;
export const TOKEN_DECIMALS = 6;
export const FAUCET_AMOUNT = 1_000_000_000n;
export const FAUCET_COOLDOWN = 17_280;
export const BLOCK_TIME_SECS = 5;