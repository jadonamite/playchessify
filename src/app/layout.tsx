import './globals.css'
import type { Metadata } from 'next'
import { Providers } from './providers'

const getProjectVerification = (): string => {
  return '4ae44f6225ea6f8305b12283c8cbc5b055b0404128fae6afca5a36768e700f17e7427898c5aeda68aaa387a7c9cf38f5f4f8a6b25e955bbe5804eb97cd30f836'
}

export const metadata: Metadata = {
  title: "CHESSIFY — Play Chess on Celo",
  description: "Wager CHESS tokens, play on-chain. Built by Velocity Labs.",
  icons: {
    icon: "/playchessify.svg",
    apple: "/playchessify.svg",
  },
  other: {
    'talentapp:project_verification': getProjectVerification(),
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head />
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}