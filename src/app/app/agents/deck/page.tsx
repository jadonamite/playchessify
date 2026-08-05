'use client'

import Link from 'next/link'
import './../agents.css'
import GlowButton from '@/components/ui/GlowButton'
import { AgentDashboard } from '../AgentDashboard'
import { useGoodAgentWallet } from '@/lib/goodagent-config'

export default function AgentsDeckPage() {
  const wallet = useGoodAgentWallet()

  return (
    <main className="pc-agents-page">
      <div className="pc-agents-shell">
        <header className="pc-agents-hero">
          <p className="pc-agents-kicker">GoodAgent · PlayChessify</p>
          <h1 className="neon-heading-accent">Command deck</h1>
          <p className="pc-agents-sub">
            Configure your agent, run autopilot, and follow live chess matches.
          </p>
          <div className="pc-agents-hero-actions">
            <Link href="/app/lobby" className="pc-agents-back">
              ← Back to lobby
            </Link>
            <Link href="/app/agents" className="pc-agents-back">
              Deploy & verify →
            </Link>
            {!wallet.isConnected && wallet.connect ? (
              <GlowButton onClick={() => void wallet.connect?.()}>Connect wallet</GlowButton>
            ) : null}
          </div>
        </header>

        <section className="pc-panel pc-panel-dashboard pc-panel-dashboard-full">
          <div className="pc-panel-head">
            <div>
              <h2 className="pc-panel-title">Your agents</h2>
              <p className="pc-panel-desc">
                Settings, autopilot controls, and match history.
              </p>
            </div>
          </div>
          <div className="pc-panel-body">
            <AgentDashboard />
          </div>
        </section>
      </div>
    </main>
  )
}
