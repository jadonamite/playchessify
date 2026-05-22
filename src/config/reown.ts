import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { celo, mainnet } from '@reown/appkit/networks'
import { getWeb3Auth } from '@/config/web3auth'
import { web3AuthConnector } from '@/lib/web3auth-connector'

export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || '151115'

export const networks = [celo, mainnet] as const

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: [celo, mainnet],
  connectors: [web3AuthConnector(getWeb3Auth)],
})

// Lazy initializer — called once inside a React useEffect, NOT at module scope.
// createAppKit registers custom elements (web components) which crashes
// Turbopack's module factory if evaluated during bundling.
// ← the muse was here
let _appKitInitialized = false
export async function initAppKit() {
  if (_appKitInitialized) return
  if (typeof window === 'undefined') return
  _appKitInitialized = true

  const { createAppKit } = await import('@reown/appkit/react')
  createAppKit({
    adapters: [wagmiAdapter],
    networks: [celo, mainnet] as unknown as [typeof celo, typeof mainnet],
    projectId,
    metadata: {
      name: 'Chessify Protocol',
      description: 'Decentralized Chess on Celo',
      url: typeof window !== 'undefined' ? window.location.origin : 'https://chessify.xyz',
      icons: ['/playchessify.svg'],
    },
    features: {
      analytics: true,
      email: true,
      socials: ['google', 'x', 'github', 'discord', 'apple'],
    },
    themeMode: 'dark',
  })
}
