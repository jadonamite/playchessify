'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { signDeployControl } from '@goodagent/widget'
import { PLAYCHESSIFY_SKILL_ID, useGoodAgentWallet } from '@/lib/goodagent-config'
import {
  gameIdFromMatchId,
  getDeployStatus,
  listPlaychessifyDeploys,
  playchessifySkill,
  startDeploy,
  stopDeploy,
  updateSkillConfiguration,
  type DeployAgent,
  type DeployStatusResponse,
} from '@/lib/goodagent-host'

const STRATEGY_PRESETS = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'aggressive', label: 'Aggressive' },
  { id: 'positional', label: 'Positional' },
  { id: 'tactical', label: 'Tactical' },
  { id: 'endgame_grind', label: 'Endgame grind' },
] as const

function statusLabel(status: string): string {
  switch (status) {
    case 'awaiting_vouch':
      return 'Awaiting vouch'
    case 'running':
      return 'Running'
    case 'paused':
      return 'Paused'
    case 'provisioning':
      return 'Provisioning'
    case 'failed':
      return 'Failed'
    default:
      return status.replace(/_/g, ' ')
  }
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function AgentDashboard() {
  const wallet = useGoodAgentWallet()
  const address = wallet.address
  const isConnected = wallet.isConnected

  const [deploys, setDeploys] = useState<DeployAgent[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [status, setStatus] = useState<DeployStatusResponse | null>(null)
  const [draftConfig, setDraftConfig] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const selectedDeploy = useMemo(
    () => deploys.find((d) => d.id === selectedId) ?? deploys[0] ?? null,
    [deploys, selectedId],
  )

  const skill = playchessifySkill(status)
  const stats = skill?.stats ?? null
  const config = skill?.configuration ?? {}
  const isOwner =
    Boolean(address) &&
    status?.ownerWallet?.toLowerCase() === address?.toLowerCase()
  const online = status?.pm2?.online ?? status?.status === 'running'
  const verified = Boolean(status?.verify?.valid && status?.verify?.agentProven)
  const provisioned = Boolean(status?.agentAddress)
  const playMode = draftConfig.PLAY_MODE ?? config.PLAY_MODE ?? 'bot'

  const refresh = useCallback(async () => {
    if (!address) return
    setLoading(true)
    setError(null)
    try {
      const list = await listPlaychessifyDeploys(address)
      const playchessifyOnly: DeployAgent[] = []
      for (const agent of list) {
        if (!agent.skills?.length) {
          playchessifyOnly.push(agent)
          continue
        }
        if (agent.skills.some((s) => s.skillId.includes('playchessify'))) {
          playchessifyOnly.push(agent)
        }
      }
      setDeploys(playchessifyOnly)
      const activeId = selectedId ?? playchessifyOnly[0]?.id ?? null
      if (activeId) {
        setSelectedId(activeId)
        const full = await getDeployStatus(activeId)
        setStatus(full)
        const sk = playchessifySkill(full)
        if (sk?.configuration) setDraftConfig({ ...sk.configuration })
      } else {
        setStatus(null)
        setDraftConfig({})
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [address, selectedId])

  useEffect(() => {
    if (!isConnected || !address) return
    void refresh()
    const timer = setInterval(() => void refresh(), 8000)
    return () => clearInterval(timer)
  }, [address, isConnected, refresh])

  const patchConfig = (key: string, value: string) => {
    setDraftConfig((prev) => ({ ...prev, [key]: value }))
  }

  const saveConfig = useCallback(async () => {
    if (!address || !selectedDeploy) return
    setBusy('save')
    setError(null)
    setNotice(null)
    try {
      const auth = await signDeployControl(wallet, 'configuration', selectedDeploy.id)
      await updateSkillConfiguration(
        selectedDeploy.id,
        PLAYCHESSIFY_SKILL_ID,
        auth,
        draftConfig,
      )
      setNotice('Settings saved — agent will restart with the new config.')
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }, [address, draftConfig, refresh, selectedDeploy, wallet])

  const runControl = useCallback(
    async (action: 'start' | 'stop') => {
      if (!address || !selectedDeploy) return
      setBusy(action)
      setError(null)
      setNotice(null)
      try {
        const auth = await signDeployControl(
          wallet,
          action === 'start' ? 'resume' : 'pause',
          selectedDeploy.id,
        )
        if (action === 'start') {
          await startDeploy(selectedDeploy.id, auth)
          setNotice('Autopilot started — your agent will scan for chess matches.')
        } else {
          await stopDeploy(selectedDeploy.id, auth)
          setNotice('Autopilot paused.')
        }
        await refresh()
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setBusy(null)
      }
    },
    [address, refresh, selectedDeploy, wallet],
  )

  const playOneMatch = useCallback(async () => {
    if (!address || !selectedDeploy) return
    setBusy('play-one')
    setError(null)
    setNotice(null)
    try {
      const configAuth = await signDeployControl(
        wallet,
        'configuration',
        selectedDeploy.id,
      )
      const oneShot = { ...draftConfig, MAX_MATCHES: '1' }
      await updateSkillConfiguration(
        selectedDeploy.id,
        PLAYCHESSIFY_SKILL_ID,
        configAuth,
        oneShot,
      )
      setDraftConfig(oneShot)
      const startAuth = await signDeployControl(wallet, 'resume', selectedDeploy.id)
      await startDeploy(selectedDeploy.id, startAuth)
      setNotice('Playing one match — your agent stops after this game.')
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }, [address, draftConfig, refresh, selectedDeploy, wallet])

  const canRunAgent = verified && provisioned && busy === null
  const runBlockedReason = !provisioned
    ? 'Agent wallet is still provisioning.'
    : !verified
      ? 'Complete GoodDollar verification on Deploy & verify first.'
      : null

  if (!isConnected) {
    return (
      <div className="pc-dash-empty">
        <p className="pc-dash-empty-title">Wallet not connected</p>
        <p className="pc-dash-empty-text">
          Connect the same wallet you used to deploy your agent.
        </p>
        {wallet.connect ? (
          <button
            type="button"
            className="pc-dash-btn pc-dash-btn-primary"
            style={{ marginTop: 12 }}
            onClick={() => void wallet.connect?.()}
          >
            Connect wallet
          </button>
        ) : null}
      </div>
    )
  }

  if (loading && !deploys.length) {
    return (
      <div className="pc-dash-empty">
        <p className="pc-dash-empty-title">Loading agents…</p>
      </div>
    )
  }

  if (!deploys.length) {
    return (
      <div className="pc-dash-empty">
        <p className="pc-dash-empty-title">No agents yet</p>
        <p className="pc-dash-empty-text">
          Deploy and verify a PlayChessify agent first, then return here to
          configure and run it.{' '}
          <Link href="/app/agents">Go to deploy →</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="pc-dash">
      {error ? <div className="pc-dash-alert pc-dash-alert-error">{error}</div> : null}
      {notice ? <div className="pc-dash-alert pc-dash-alert-ok">{notice}</div> : null}

      {isOwner && !verified ? (
        <div className="pc-dash-verify-banner">
          <div>
            <p className="pc-dash-verify-title">Finish verification to play</p>
            <p className="pc-dash-verify-text">
              Deploy succeeded, but your agent cannot join matches until GoodDollar
              vouching is complete. Open Deploy & verify and use the Verify tab.
            </p>
          </div>
          <Link href="/app/agents" className="pc-dash-btn pc-dash-btn-primary">
            Complete verification →
          </Link>
        </div>
      ) : null}

      <div className="pc-dash-command">
        <div className="pc-dash-command-main">
          {deploys.length > 1 ? (
            <select
              className="pc-dash-select"
              value={selectedDeploy?.id ?? ''}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {deploys.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.displayName}
                </option>
              ))}
            </select>
          ) : (
            <h3 className="pc-dash-agent-name">
              {selectedDeploy?.displayName ?? 'Your agent'}
            </h3>
          )}
          <div className="pc-dash-badges">
            <span className={`pc-dash-pill pc-dash-pill-${online ? 'online' : 'offline'}`}>
              <span className="pc-dash-dot" aria-hidden />
              {online ? 'Online' : 'Offline'}
            </span>
            <span className={`pc-dash-pill pc-dash-pill-${verified ? 'ok' : 'warn'}`}>
              {verified ? 'Verified' : 'Needs vouch'}
            </span>
            <span className="pc-dash-pill pc-dash-pill-muted">
              {statusLabel(status?.status ?? '—')}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="pc-dash-btn pc-dash-btn-ghost pc-dash-btn-sm"
          disabled={loading}
          onClick={() => void refresh()}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="pc-dash-stats">
        <article className="pc-stat">
          <p className="pc-stat-label">Record</p>
          <p className="pc-stat-value">
            {stats ? `${stats.wins ?? 0}W · ${stats.losses ?? 0}L` : '—'}
          </p>
          <p className="pc-stat-meta">
            {stats?.matchesToday != null
              ? `${stats.matchesToday} today`
              : 'No matches yet'}
          </p>
        </article>
        <article className="pc-stat">
          <p className="pc-stat-label">Mode</p>
          <p className="pc-stat-value pc-stat-cap">{config.PLAY_MODE ?? 'bot'}</p>
          <p className="pc-stat-meta">{config.STRATEGY_PRESET ?? 'balanced'}</p>
        </article>
        <article className="pc-stat">
          <p className="pc-stat-label">Max wager</p>
          <p className="pc-stat-value">{config.MAX_WAGER ?? '100'}</p>
          <p className="pc-stat-meta">CHESS</p>
        </article>
        <article className="pc-stat">
          <p className="pc-stat-label">Agent wallet</p>
          <p className="pc-stat-value pc-stat-mono">
            {status?.agentAddress ? shortAddress(status.agentAddress) : '—'}
          </p>
          <p className="pc-stat-meta">{provisioned ? 'Provisioned' : 'Pending'}</p>
        </article>
      </div>

      {isOwner ? (
        <section className="pc-dash-config">
          <div className="pc-dash-config-head">
            <h3>Agent settings</h3>
            <p>
              Configure how your agent finds and plays chess matches.
              {!verified ? ' You can save settings now; play controls unlock after verification.' : null}
            </p>
          </div>
          <div className="pc-dash-config-grid">
            <label className="pc-field">
              <span>Play mode</span>
              <select
                className="pc-input"
                value={playMode}
                onChange={(e) => patchConfig('PLAY_MODE', e.target.value)}
              >
                <option value="bot">Join bot lobbies</option>
                <option value="host">Host a room</option>
                <option value="join">Join open lobby</option>
              </select>
            </label>
            <label className="pc-field">
              <span>Strategy</span>
              <select
                className="pc-input"
                value={draftConfig.STRATEGY_PRESET ?? config.STRATEGY_PRESET ?? 'balanced'}
                onChange={(e) => patchConfig('STRATEGY_PRESET', e.target.value)}
              >
                {STRATEGY_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="pc-field">
              <span>Max wager (CHESS)</span>
              <input
                className="pc-input"
                type="number"
                min={1}
                value={draftConfig.MAX_WAGER ?? config.MAX_WAGER ?? '100'}
                onChange={(e) => patchConfig('MAX_WAGER', e.target.value)}
              />
            </label>
            {playMode === 'host' ? (
              <label className="pc-field">
                <span>Host wager (CHESS)</span>
                <input
                  className="pc-input"
                  type="number"
                  min={1}
                  value={draftConfig.HOST_WAGER ?? config.HOST_WAGER ?? draftConfig.MAX_WAGER ?? '100'}
                  onChange={(e) => patchConfig('HOST_WAGER', e.target.value)}
                />
              </label>
            ) : null}
            {playMode === 'join' ? (
              <label className="pc-field">
                <span>Join game ID (optional)</span>
                <input
                  className="pc-input"
                  type="number"
                  min={1}
                  placeholder="From hosting agent"
                  value={draftConfig.JOIN_GAME_ID ?? config.JOIN_GAME_ID ?? ''}
                  onChange={(e) => patchConfig('JOIN_GAME_ID', e.target.value)}
                />
              </label>
            ) : null}
            {playMode === 'bot' ? (
              <>
                <label className="pc-field">
                  <span>Bot Elo min</span>
                  <input
                    className="pc-input"
                    type="number"
                    min={600}
                    value={draftConfig.TARGET_BOT_MIN_ELO ?? config.TARGET_BOT_MIN_ELO ?? '600'}
                    onChange={(e) => patchConfig('TARGET_BOT_MIN_ELO', e.target.value)}
                  />
                </label>
                <label className="pc-field">
                  <span>Bot Elo max</span>
                  <input
                    className="pc-input"
                    type="number"
                    min={600}
                    value={draftConfig.TARGET_BOT_MAX_ELO ?? config.TARGET_BOT_MAX_ELO ?? '1200'}
                    onChange={(e) => patchConfig('TARGET_BOT_MAX_ELO', e.target.value)}
                  />
                </label>
              </>
            ) : null}
            <label className="pc-field">
              <span>Max matches / run</span>
              <input
                className="pc-input"
                type="number"
                min={1}
                value={draftConfig.MAX_MATCHES ?? config.MAX_MATCHES ?? '3'}
                onChange={(e) => patchConfig('MAX_MATCHES', e.target.value)}
              />
            </label>
            <label className="pc-field">
              <span>Daily cap</span>
              <input
                className="pc-input"
                type="number"
                min={1}
                value={draftConfig.DAILY_MATCH_CAP ?? config.DAILY_MATCH_CAP ?? '20'}
                onChange={(e) => patchConfig('DAILY_MATCH_CAP', e.target.value)}
              />
            </label>
            <label className="pc-field">
              <span>Interval (seconds)</span>
              <input
                className="pc-input"
                type="number"
                min={30}
                value={draftConfig.MATCH_INTERVAL_SECONDS ?? config.MATCH_INTERVAL_SECONDS ?? '60'}
                onChange={(e) => patchConfig('MATCH_INTERVAL_SECONDS', e.target.value)}
              />
            </label>
          </div>
          <div className="pc-dash-actions">
            <button
              type="button"
              className="pc-dash-btn pc-dash-btn-primary"
              disabled={busy !== null}
              onClick={() => void saveConfig()}
            >
              {busy === 'save' ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </section>
      ) : null}

      {isOwner ? (
        <section className="pc-dash-playdeck">
          <div className="pc-dash-playdeck-copy">
            <p className="pc-dash-playdeck-title">Run agent</p>
            <p className="pc-dash-playdeck-hint">
              Play a single match, or start autopilot to keep scanning on an interval.
              Bot mode waits for an open bot lobby; use Host mode to open a room you
              can join from the lobby.
            </p>
            {runBlockedReason ? (
              <p className="pc-dash-playdeck-blocked">{runBlockedReason}</p>
            ) : null}
          </div>
          <div className="pc-dash-actions">
            {online ? (
              <button
                type="button"
                className="pc-dash-btn"
                disabled={!canRunAgent}
                title={runBlockedReason ?? undefined}
                onClick={() => void runControl('stop')}
              >
                {busy === 'stop' ? 'Stopping…' : 'Pause agent'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="pc-dash-btn pc-dash-btn-primary"
                  disabled={!canRunAgent}
                  title={runBlockedReason ?? undefined}
                  onClick={() => void playOneMatch()}
                >
                  {busy === 'play-one' ? 'Starting…' : 'Play one match'}
                </button>
                <button
                  type="button"
                  className="pc-dash-btn"
                  disabled={!canRunAgent}
                  title={runBlockedReason ?? undefined}
                  onClick={() => void runControl('start')}
                >
                  {busy === 'start' ? 'Starting…' : 'Start autopilot'}
                </button>
              </>
            )}
          </div>
        </section>
      ) : null}

      {stats?.summary && stats.matches?.length ? (
        <p className="pc-dash-summary">{stats.summary}</p>
      ) : null}

      {stats?.matches?.length ? (
        <div className="pc-match-block">
          <div className="pc-match-block-head">
            <h3>Recent matches</h3>
            <span>{stats.matches.length} total</span>
          </div>
          <div className="pc-match-table-wrap">
            <table className="pc-match-table">
              <thead>
                <tr>
                  <th>Result</th>
                  <th>Game</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {stats.matches.slice(0, 10).map((m) => {
                  const gameId = gameIdFromMatchId(m.matchId)
                  return (
                    <tr key={m.matchId}>
                      <td>
                        <span className={`pc-result pc-result-${m.result}`}>
                          {m.result}
                        </span>
                      </td>
                      <td>
                        {gameId ? (
                          <Link href={`/app/game/${gameId}`} className="pc-match-link">
                            #{gameId}
                          </Link>
                        ) : (
                          <code className="pc-match-id">{m.matchId}</code>
                        )}
                      </td>
                      <td className="pc-match-time">
                        {new Date(m.at).toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
