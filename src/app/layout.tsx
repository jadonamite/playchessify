import './globals.css'
import type { Metadata } from 'next'
import { Providers } from './providers'

export const metadata: Metadata = {
  metadataBase: new URL("https://celo.playchessify.xyz"),
  title: {
    default: "Chessify — Learn, Play & Stake Chess On-Chain",
    template: "%s · Chessify",
  },
  description:
    "Train with grandmaster AI coaches, wager CHESS tokens on real games, and keep every coin you win. On-chain chess across Celo, Stacks and Base.",
  applicationName: "Chessify",
  keywords: [
    "chess",
    "play chess online",
    "crypto chess",
    "on-chain chess",
    "chess wager",
    "CHESS token",
    "Celo",
    "Base",
    "Stacks",
    "chess coach",
    'web3 chess',
  ],
  alternates: { canonical: "/" },
  icons: {
    icon: "/playchessify.svg",
    apple: "/playchessify.svg",
  },
  openGraph: {
    type: "website",
    siteName: "Chessify",
    url: "/",
    title: "Chessify — Learn, Play & Stake Chess On-Chain",
    description:
      "Train with grandmaster AI coaches, wager CHESS tokens on real games, and keep every coin you win.",
    images: [{ url: "/chessify.png", width: 1522, height: 294, alt: "Chessify" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@playchessify",
    creator: "@playchessify",
    title: "Chessify — Learn, Play & Stake Chess On-Chain",
    description:
      "Train with grandmaster AI coaches, wager CHESS tokens on real games, and keep every coin you win.",
    images: ["/chessify.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  other: {
    "talentapp:project_verification":
  "4ae44f6225ea6f8305b12283c8cbc5b055b0404128fae6afca5a36768e700f17e7427898c5aeda68aaa387a7c9cf38f5f4f8a6b25e955bbe5804eb97cd30f836",
  },
};


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
