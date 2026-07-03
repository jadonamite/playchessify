'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { WagmiProvider } from '@privy-io/wagmi'
import { PrivyProvider } from '@privy-io/react-auth'
import { SmartWalletsProvider } from '@privy-io/react-auth/smart-wallets'
import dynamic from 'next/dynamic'
import { celo } from 'viem/chains'
import { wagmiConfig } from '@/config/wagmi'
import { ThemeProvider } from 'next-themes'
import CenterToast from '@/components/ui/CenterToast'

const WalletProvider = dynamic(
  () => import('@/components/wallet-provider').then(mod => mod.WalletProvider),
  { ssr: false }
)

const AudioManager = dynamic(
  () => import('@/components/AudioManager'),
  { ssr: false }
)

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60 * 1000 },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? 'placeholder-set-env-var'}
        config={{
          defaultChain: celo,
          supportedChains: [celo],
          appearance: {
            theme: 'dark',
            accentColor: '#00ccff',
            logo: '/chessify.png',
            walletChainType: 'ethereum-only',
          },
          loginMethods: ['google', 'twitter', 'discord', 'github', 'email', 'wallet'],
          embeddedWallets: {
            ethereum: {
              createOnLogin: 'users-without-wallets',
            },
          },
        }}
      >
        <WagmiProvider config={wagmiConfig} reconnectOnMount>
          {/* Tier A — ERC-4337 smart wallets for social/email/embedded users.
              The Celo custom-chain config (forno RPC + Pimlico bundler/paymaster URLs,
              PIMLICO_API_KEY) is set in the Privy dashboard; sponsorship is then automatic. */}
          <SmartWalletsProvider>
            <ThemeProvider attribute="payload-theme" defaultTheme="dark" enableSystem={false}>
              <WalletProvider>
                <AudioManager />
                {children}
                <CenterToast />
              </WalletProvider>
            </ThemeProvider>
          </SmartWalletsProvider>
        </WagmiProvider>
      </PrivyProvider>
    </QueryClientProvider>
  )
}
