import { createConfig } from '@privy-io/wagmi'
import { celo, celoAlfajores, mainnet } from 'viem/chains'
import { http } from 'wagmi'
import { injected } from 'wagmi/connectors'

const createWagmiConfig = (chains: any[], connectors: any[], transports: any) => {
  return createConfig({
    chains,
    connectors,
    transports,
  })
}

export const wagmiConfig = createWagmiConfig([
  celo,
  celoAlfajores,
  mainnet,
], [
  injected(),
], {
  [celo.id]: http('https://forno.celo.org'),
  [celoAlfajores.id]: http('https://alfajores-forno.celo-testnet.org'),
  [mainnet.id]: http(),
})