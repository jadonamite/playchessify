import { createConfig } from '@privy-io/wagmi'
import { celo, celoAlfajores, mainnet } from 'viem/chains'
import { http } from 'wagmi'
import { injected } from 'wagmi/connectors'

const createWagmiConfig = () => {
  const chains = [celo, celoAlfajores, mainnet]
  const connectors = [injected()]
  const transports = {
    [celo.id]: http('https://forno.celo.org'),
    [celoAlfajores.id]: http('https://alfajores-forno.celo-testnet.org'),
    [mainnet.id]: http(),
  }

  return createConfig({ chains, connectors, transports })
}

export const wagmiConfig = createWagmiConfig()