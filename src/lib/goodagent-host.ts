import type { DeployControlAuth } from './goodagent-auth'

/** Same-origin proxy — see app/api/goodagent/[...path]/route.ts */
const HOST_BASE = '/api/goodagent'

export const PLAYCHESSIFY_SKILL_FILTER = 'playchessify'

export interface DeployAgent {
  id: string
  displayName: string
  status: string
  agentAddress: string | null
  ownerWallet: string | null
  lastError: string | null
  skills?: Array<{ skillId: string; status?: string }>
}

export interface SkillStatsView {
  gamesPlayed?: number
  wins?: number
  losses?: number
  unresolved?: number
  matchesToday?: number
  summary?: string | null
  matches?: Array<{
    matchId: string
    result: 'won' | 'lost' | 'unresolved'
    at: string
    wagerGs?: number
  }>
  meta?: {
    strategyPreset?: string
    maxWagerChess?: string
    minBotElo?: string
    maxBotElo?: string
  }
  logTail?: string | null
}

export interface DeployStatusResponse {
  id: string
  displayName?: string
  status: string
  ownerWallet?: string | null
  agentAddress: string | null
  lastError: string | null
  pipelineRunning: boolean
  verify: {
    valid?: boolean
    agentProven?: boolean
    reason?: string
  } | null
  skills?: Array<{
    skillId: string
    status: string
    configuration: Record<string, string>
    stats?: SkillStatsView | null
  }>
  pm2?: {
    status: string
    online: boolean
  } | null
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  let data: (T & { error?: string; message?: string }) | null = null

  if (text.trim()) {
    try {
      data = JSON.parse(text) as T & { error?: string; message?: string }
    } catch {
      const snippet = text.trim().slice(0, 120)
      throw new Error(
        res.ok
          ? `Host returned invalid JSON: ${snippet}`
          : `Host error (${res.status}): ${snippet}`,
      )
    }
  }

  if (!res.ok) {
    throw new Error(
      data?.message ?? data?.error ?? `Request failed (${res.status})`,
    )
  }

  return (data ?? ({} as T)) as T
}

export async function listPlaychessifyDeploys(
  ownerWallet: string,
): Promise<DeployAgent[]> {
  const res = await fetch(
    `${HOST_BASE}/deploy?ownerWallet=${encodeURIComponent(ownerWallet)}`,
    { cache: 'no-store' },
  )
  const data = await readJson<{ agents: DeployAgent[] }>(res)
  return data.agents.filter((a) => {
    if (!a.skills?.length) return true
    return a.skills.some((s) => s.skillId.includes(PLAYCHESSIFY_SKILL_FILTER))
  })
}

export async function getDeployStatus(
  deployId: string,
): Promise<DeployStatusResponse> {
  const res = await fetch(`${HOST_BASE}/deploy/${deployId}/status`, {
    cache: 'no-store',
  })
  return readJson<DeployStatusResponse>(res)
}

export async function startDeploy(
  deployId: string,
  auth: DeployControlAuth,
): Promise<void> {
  const res = await fetch(`${HOST_BASE}/deploy/${deployId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(auth),
  })
  await readJson(res)
}

export async function stopDeploy(
  deployId: string,
  auth: DeployControlAuth,
): Promise<void> {
  const res = await fetch(`${HOST_BASE}/deploy/${deployId}/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(auth),
  })
  await readJson(res)
}

export async function updateSkillConfiguration(
  deployId: string,
  skillId: string,
  auth: DeployControlAuth,
  configuration: Record<string, string>,
): Promise<void> {
  // skillId contains slashes — must not encode into the URL path (nginx rejects %2F).
  const res = await fetch(`${HOST_BASE}/deploy/${deployId}/configuration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...auth, skillId, configuration }),
  })
  await readJson(res)
}

export function playchessifySkill(status: DeployStatusResponse | null) {
  return (
    status?.skills?.find((s) => s.skillId.includes(PLAYCHESSIFY_SKILL_FILTER)) ??
    null
  )
}

export function gameIdFromMatchId(matchId: string): string | null {
  const m = /^PC-(\d+)$/i.exec(matchId.trim())
  return m?.[1] ?? null
}
