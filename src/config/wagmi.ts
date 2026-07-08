import { createConfig } from '@privy-io/wagmi'
import { celo, celoAlfajores, mainnet } from 'viem/chains'
import { http } from 'wagmi'
import { injected } from 'wagmi/connectors'

const createTransports = (chains: any[]) => {
  const transports: any = {}
  chains.forEach((chain: any) => {
    if (chain.id === celo.id) {
      transports[chain.id] = http('https://forno.celo.org')
    } else if (chain.id === celoAlfajores.id) {
      transports[chain.id] = http('https://alfajores-forno.celo-testnet.org')
    } else if (chain.id === mainnet.id) {
      transports[chain.id] = http()
    }
  })
  return transports
}

export const wagmiConfig = createConfig({
  chains: [celo, celoAlfajores, mainnet],
  connectors: [injected()],
  transports: createTransports([celo, celoAlfajores, mainnet]),
})