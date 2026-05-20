'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { WagmiProvider } from 'wagmi'
import dynamic from 'next/dynamic'
import { wagmiAdapter, initAppKit } from '@/config/reown'

import { ThemeProvider } from 'next-themes'

const WalletProvider = dynamic(
  () => import('@/components/wallet-provider').then(mod => mod.WalletProvider),
  { ssr: false }
)

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  }))

  const [ready, setReady] = useState(false)
  useEffect(() => {
    initAppKit().then(() => setReady(true))
  }, [])

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false}>
          {ready ? (
            <WalletProvider>
              {children}
            </WalletProvider>
          ) : (
            <>{children}</>
          )}
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
