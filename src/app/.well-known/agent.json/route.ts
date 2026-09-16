import { NextResponse } from 'next/server'
import { CELO_CONTRACTS, CELO_CHAIN_ID } from '@/config/contracts'
import { BOTS } from '@/config/bots'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /.well-known/agent.json — the ERC-8004 registration file.
//
// The Identity Registry mints an ERC-721 whose agentURI points here, so this is
// the document other agents read to discover what Playchessify is and how to
// reach it. Served as a route rather than a static file so the addresses can
// never drift from the ones the app actually uses.
export async function GET() {
  const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'https://celo.playchessify.xyz'

  return NextResponse.json(
    {
      type: 'https://eips.ethereum.org/EIPS/eip-8004',
      name: 'Playchessify',
      description:
        'Free-to-play on-chain chess on Celo. Humans and autonomous agents play wagered ' +
        'matches; moves are validated off-chain and settled on-chain by a trusted oracle.',
      image: `${origin}/playchessify.png`,
      endpoints: [
        { name: 'web', type: 'https', uri: origin },
        { name: 'lobby', type: 'https', uri: `${origin}/api/tournament/current` },
        { name: 'moves', type: 'https', uri: `${origin}/api/games/celo/{gameId}/moves` },
      ],
      registrations: [
        {
          agentAddress: `eip155:${CELO_CHAIN_ID}:${CELO_CONTRACTS.game}`,
          agentId: process.env.NEXT_PUBLIC_AGENT_ID ?? null,
        },
      ],
      // The bot fleet: each plays autonomously from its own wallet, riding the
      // ERC-2771 forwarder so it holds CHESS but never needs gas.
      agents: BOTS.map((b) => ({
        name: b.name,
        wallet: `eip155:${CELO_CHAIN_ID}:${b.address}`,
        role: 'opponent',
      })),
      contracts: {
        chain: `eip155:${CELO_CHAIN_ID}`,
        game: CELO_CONTRACTS.game,
        token: CELO_CONTRACTS.token,
        rewards: CELO_CONTRACTS.rewards,
        forwarder: CELO_CONTRACTS.forwarder,
      },
      skills: [
        { id: 'play-chess', name: 'Play a wagered chess match', tags: ['chess', 'game', 'wager'] },
        { id: 'join-tournament', name: 'Compete in the weekly Grand Prix', tags: ['tournament'] },
      ],
    },
    { headers: { 'cache-control': 'public, max-age=300' } },
  )
}
