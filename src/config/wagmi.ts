import { createConfig } from '@privy-io/wagmi'
import { celo, celoAlfajores, mainnet } from 'viem/chains'
import { http } from 'wagmi'
import { injected } from 'wagmi/connectors'

const createTransport = (chainId: string, url: string) => {
  return http(url)
}

const createTransports = (chains: any[]) => {
  const transports: any = {}
  chains.forEach((chain: any) => {
    if (chain.id === mainnet.id) {
      transports[chain.id] = http()
    } else {
      transports[chain.id] = createTransport(chain.id, `https://forno.celo.org`)
    }
  })
  transports[celoAlfajores.id] = createTransport(celoAlfajores.id, `https://alfajores-forno.celo-testnet.org`)
  return transports
}

export const wagmiConfig = createConfig({
  // Alfajores included so a testnet rehearsal build can target it via env.
  chains: [celo, celoAlfajores, mainnet],
  // Injected connector lets us auto-connect MiniPay's in-app wallet.
  connectors: [injected()],
  transports: createTransports([celo, celoAlfajores, mainnet]),
})