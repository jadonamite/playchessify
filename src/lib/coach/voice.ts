/**
 * Coach voice layer — turns ENGINE FACTS into a coach-voiced lesson.
 *
 * Hard rule: the LLM never decides chess. Every chess fact (best move, eval
 * delta, the concept that was missed) comes from Stockfish and is passed in.
 * The LLM only phrases it in the coach's personality. If every provider is
 * down or rate-limited, `renderTemplate` produces a correct (plainer) lesson
 * with zero network — so a lesson can never crash or lie.
 *
 * Provider chain (all free tiers): NVIDIA NIM → Gemini Flash → Groq → template.
 * SERVER ONLY — never import into client code; keys must never be NEXT_PUBLIC.
 */

import OpenAI from 'openai'

if (typeof window !== 'undefined') {
  throw new Error('coach/voice.ts is server-only — do not import it in the browser')
}

type AIMessage = { role: 'system' | 'user' | 'assistant'; content: string }

interface Provider {
  name: string
  client: OpenAI
  model: string
}

/** Build the provider chain from whichever keys are present, in priority order. */
function buildProviders(): Provider[] {
  const providers: Provider[] = []

  if (process.env.NVIDIA_API_KEY) {
    providers.push({
      name: 'nvidia-nim',
      client: new OpenAI({ apiKey: process.env.NVIDIA_API_KEY, baseURL: 'https://integrate.api.nvidia.com/v1' }),
      model: process.env.NIM_MODEL || 'meta/llama-3.3-70b-instruct',
    })
  }
  if (process.env.GEMINI_API_KEY) {
    providers.push({
      name: 'gemini-flash',
      client: new OpenAI({ apiKey: process.env.GEMINI_API_KEY, baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' }),
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    })
  }
  if (process.env.GROQ_API_KEY) {
    providers.push({
      name: 'groq',
      client: new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' }),
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    })
  }
  return providers
}

let cachedProviders: Provider[] | null = null
function providers(): Provider[] {
  if (!cachedProviders) cachedProviders = buildProviders()
  return cachedProviders
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await p
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Run the provider chain. Each provider gets a 4s timeout + 1 retry; on
 * failure we drop to the next. Throws only if EVERY provider fails — callers
 * (coachExplain) catch that and fall back to the template.
 */
async function complete(messages: AIMessage[], opts: { maxTokens?: number; temperature?: number } = {}): Promise<string> {
  const { maxTokens = 160, temperature = 0.5 } = opts
  const chain = providers()
  if (chain.length === 0) throw new Error('no LLM providers configured')

  let lastErr: Error | null = null
  for (const p of chain) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await withTimeout(
          p.client.chat.completions.create({ model: p.model, messages, max_tokens: maxTokens, temperature }),
          4000,
        )
        const text = res.choices[0]?.message?.content?.trim()
        if (text) return text
        throw new Error('empty completion')
      } catch (err) {
        lastErr = err as Error
        console.warn(`[coach/voice] ${p.name} attempt ${attempt + 1} failed:`, lastErr.message)
      }
    }
  }
  throw lastErr ?? new Error('all providers failed')
}

/* ── lesson facts ───────────────────────────────────────────────────────────
 * Everything the voice layer needs is supplied by the engine + learner model.
 * The LLM adds no chess knowledge of its own. */
export type ExplainKind = 'blunder' | 'good' | 'coach-move' | 'review'
export type LearnerLevel = 'basics' | 'intermediate' | 'expert'

export interface ExplainFacts {
  coachName: string
  coachVoice: string // persona system-prompt from CoachProfile.teaching.voice
  learnerLevel: LearnerLevel
  kind: ExplainKind
  playerMoveSan?: string // the move the learner made / is about to make
  bestMoveSan?: string   // Stockfish's best move in SAN
  evalDeltaCp?: number   // centipawns lost by the learner's move (+ = worse)
  concept?: string       // tag, e.g. 'hanging piece', 'missed fork'
  detail?: string        // factual phrase from analysis, e.g. 'the knight on f6 is undefended'
  movesPlayed?: number   // for review framing
}

/** Deterministic floor — correct lesson text from engine facts, no network. */
export function renderTemplate(f: ExplainFacts): string {
  const lost = f.evalDeltaCp != null ? Math.round(f.evalDeltaCp) / 100 : null
  switch (f.kind) {
    case 'blunder': {
      const bits: string[] = []
      bits.push(f.detail ? `Careful — ${f.detail}.` : 'Careful — that move gives something away.')
      if (f.concept) bits.push(`This is about ${f.concept}.`)
      if (f.bestMoveSan) bits.push(`A stronger try is ${f.bestMoveSan}.`)
      if (lost != null && lost >= 1) bits.push(`It costs roughly ${lost.toFixed(1)} points of advantage.`)
      return bits.join(' ')
    }
    case 'good': {
      const head = f.playerMoveSan ? `Good — ${f.playerMoveSan} is the right idea.` : 'Good — that\'s the right idea.'
      return f.concept ? `${head} You spotted the ${f.concept}.` : head
    }
    case 'coach-move': {
      return f.detail
        ? `I'll play ${f.playerMoveSan ?? 'this'} — ${f.detail}.`
        : `I'll play ${f.playerMoveSan ?? 'this'}.`
    }
    case 'review': {
      const head = f.movesPlayed ? `Nice work over ${f.movesPlayed} moves.` : 'Nice work.'
      return f.concept ? `${head} Next, let's sharpen your ${f.concept}.` : `${head} Let's keep building.`
    }
  }
}

/**
 * Produce a coach-voiced lesson. Tries the LLM chain; on any failure returns
 * the deterministic template. The chess content is identical either way —
 * only the wording degrades.
 */
export async function coachExplain(f: ExplainFacts): Promise<{ text: string; source: 'llm' | 'template' }> {
  const fallback = renderTemplate(f)
  if (providers().length === 0) return { text: fallback, source: 'template' }

  const facts = [
    `Coach: ${f.coachName}`,
    `Student level: ${f.learnerLevel}`,
    `Situation: ${f.kind}`,
    f.playerMoveSan && `Student move: ${f.playerMoveSan}`,
    f.bestMoveSan && `Engine's best move: ${f.bestMoveSan}`,
    f.evalDeltaCp != null && `Centipawns lost: ${Math.round(f.evalDeltaCp)}`,
    f.concept && `Concept: ${f.concept}`,
    f.detail && `Engine note: ${f.detail}`,
  ].filter(Boolean).join('\n')

  const messages: AIMessage[] = [
    {
      role: 'system',
      content: `${f.coachVoice}\n\nYou are giving a single short coaching note (1-2 sentences, max ~40 words). ` +
        `Use ONLY the chess facts provided — never invent moves, evaluations, or threats. ` +
        `Speak in character, plainly, at the student's level. No move lists, no markdown.`,
    },
    { role: 'user', content: `${facts}\n\nGive your coaching note:` },
  ]

  try {
    const text = await complete(messages, { maxTokens: 120, temperature: 0.55 })
    return { text, source: 'llm' }
  } catch (err) {
    console.warn('[coach/voice] all providers failed, using template:', (err as Error).message)
    return { text: fallback, source: 'template' }
  }
}
