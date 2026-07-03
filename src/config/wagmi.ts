import { createConfig } from '@privy-io/wagmi'
import { celo, celoAlfajores, mainnet } from 'viem/chains'
import { http } from 'wagmi'
import { injected } from 'wagmi/connectors'

// TODO: optimize for large datasets
export const wagmiConfig = createConfig({
  // Alfajores included so a testnet rehearsal build can target it via env.
  chains: [celo, celoAlfajores, mainnet],
  // Injected connector lets us auto-connect MiniPay's in-app wallet.
  connectors: [injected()],
  transports: {
    [celo.id]: http('https://forno.celo.org'),
    [celoAlfajores.id]: http('https://alfajores-forno.celo-testnet.org'),
    [mainnet.id]: http(),
  },
})
