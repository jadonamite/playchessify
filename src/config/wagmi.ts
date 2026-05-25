import { createConfig } from '@privy-io/wagmi'
import { celo, mainnet } from 'viem/chains'
import { http } from 'wagmi'

export const wagmiConfig = createConfig({
  chains: [celo, mainnet],
  transports: {
    [celo.id]: http('https://forno.celo.org'),
    [mainnet.id]: http(),
  },
})
