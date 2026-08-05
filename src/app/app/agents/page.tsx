'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GoodAgentWidget } from '@goodagent/widget'
import '@goodagent/widget/styles.css'
import './agents.css'
import GlowButton from '@/components/ui/GlowButton'
import {
  useGoodAgentWallet,
  useGoodAgentWidgetConfig,
} from '@/lib/goodagent-config'

export default function AgentsOnboardPage() {
  const router = useRouter()
  const wallet = useGoodAgentWallet()
  const config = useGoodAgentWidgetConfig()

  return (
    <main className="pc-agents-page">
      <div className="pc-agents-shell pc-agents-shell-narrow">
        <header className="pc-agents-hero">
          <p className="pc-agents-kicker">GoodAgent · PlayChessify</p>
          <h1 className="neon-heading-accent">Deploy your chess agent</h1>
          <p className="pc-agents-sub">
            Create a GoodAgent and complete verification here. Configure strategy,
            autopilot, and match history on your command deck after deploy.
          </p>
          <div className="pc-agents-hero-actions">
            <Link href="/app/lobby" className="pc-agents-back">
              ← Back to lobby
            </Link>
            <Link href="/app/agents/deck" className="pc-agents-back">
              Open command deck →
            </Link>
            {!wallet.isConnected && wallet.connect ? (
              <GlowButton onClick={() => void wallet.connect?.()}>Connect wallet</GlowButton>
            ) : null}
          </div>
        </header>

        <section className="pc-panel pc-panel-deploy">
          <div className="pc-panel-head">
            <div>
              <h2 className="pc-panel-title">Deploy & verify</h2>
              <p className="pc-panel-desc">
                Create a new agent or finish GoodDollar verification.
              </p>
            </div>
          </div>
          <div className="pc-panel-body pc-agents-widget">
            <GoodAgentWidget
              mode="onboard"
              wallet={wallet}
              config={config}
              onOnboardComplete={() => router.push('/app/agents/deck')}
            />
          </div>
        </section>
      </div>
    </main>
  )
}
