import './globals.css'
import type { Metadata } from 'next'
import { Providers } from './providers'

const getMetadata = (): Metadata => ({
  metadataBase: new URL("https://celo.playchessify.xyz"),
  title: {
    default: "Chessify — Learn, Play & Stake Chess On-Chain",
    template: "%s · Chessify",
  },
  description:
    "Train with grandmaster AI coaches, wager CHESS tokens on real games, and keep every coin you win. On-chain chess across Celo, Stacks and Base.\