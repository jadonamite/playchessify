/**
 * Coach voice layer — turns ENGINE FACTS into a coach-voiced lesson.
 *
 * Hard rule: the LLM never decides chess. Every chess fact (best move, eval
 * delta, the concept that was missed) comes from Stockfish and is passed in.
 * The LLM only phrases it in the coach's personality. If every provider is
 * down or rate-limited, `renderTemplate` produces a correct (plainer) lesson
 * with zero network — so a lesson can never crash or lie.
 *
 * Provider chain (all free tiers): Groq → Gemini Flash → NVIDIA NIM → template.
 * SERVER ONLY — never import into client code; keys must never be NEXT_PUBLIC.
 *
 * The order and the per-provider options below are measured, not guessed:
 *   Groq   openai/gpt-oss-120b returns an EMPTY string unless reasoning_effort
 *          is lowered — the reasoning tokens consume the whole budget. With it,
 *          ~550ms, which is the only latency in this list that suits a game.
 *   Gemini gemini-flash-latest counts thinking against max_tokens, so a 200-token
 *          budget came back truncated mid-word. It needs room and ~8s.
 *   NVIDIA 410 Gone means the MODEL id is retired, not that the key is bad —
 *          every older llama/nemotron id now answers 410. deepseek-v4-flash is
 *          current and good (~13.6s). gemma-4-31b works but takes 45s;
 *          nemotron-3.5-lightning leaks "Here's a thinking process:" into the
 *          reply; glm-5.3-flash and muse-glimmer return empty. Check
 *          build.nvidia.com/models before changing this id.
 */

import OpenAI from 'openai'
import { describeMove, describeEval, sentence } from '@/lib/chess-language'

if (typeof window !== 'undefined') {
  throw new Error('coach/voice.ts is server-only — do not import it in the browser')
}

type AIMessage = { role: 'system' | 'user' | 'assistant'; content: string }

/** Per-attempt deadline. Two attempts across three providers is the worst case,
 *  so this bounds a completion at roughly 6 x this before the template wins. */
const PROVIDER_TIMEOUT_MS = Number(process.env.COACH_LLM_TIMEOUT_MS ?? 4000)

interface Provider {
  name: string
  client: OpenAI
  model: string
  /** Extra body params this provider needs to produce usable output. */
  extra?: Record<string, unknown>
  /** Per-provider deadline — they are not remotely comparable in speed. */
  timeoutMs?: number
}

/** Build the provider chain from whichever keys are present, in priority order. */
function buildProviders(): Provider[] {
  const providers: Provider[] = []

  if (process.env.GROQ_API_KEY) {
    providers.push({
      name: 'groq',
      client: new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' }),
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      // Without this the model spends its whole budget reasoning and returns
      // an empty string, which the chain then treats as a failure.
      extra: { reasoning_effort: 'low' },
      timeoutMs: 6000,
    })
  }
  if (process.env.GEMINI_API_KEY) {
    providers.push({
      name: 'gemini-flash',
      client: new OpenAI({ apiKey: process.env.GEMINI_API_KEY, baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' }),
      model: process.env.GEMINI_MODEL || 'gemini-flash-latest',
      // Thinking counts against max_tokens here, so the cap has to leave room
      // for it or the coaching line comes back cut off mid-word.
      extra: { reasoning_effort: 'none', max_tokens: 600 },
      timeoutMs: 14000,
    })
  }
  if (process.env.NVIDIA_API_KEY) {
    providers.push({
      name: 'nvidia-nim',
      client: new OpenAI({ apiKey: process.env.NVIDIA_API_KEY, baseURL: 'https://integrate.api.nvidia.com/v1' }),
      model: process.env.NIM_MODEL || 'deepseek-ai/deepseek-v4-flash-0731',
      timeoutMs: 20000,
    })
  }
  return providers
}

let cachedProviders: Provider[] | null = null
function providers(): Provider[] {
  if (!cachedProviders) cachedProviders = buildProviders()
  return cachedProviders
}

/**
 * Run one provider call under a real deadline.
 *
 * The previous version built an AbortController, fired it on a timer, and never
 * gave the signal to anything — the request had already been created by the time
 * this function received the promise, and nothing raced it. So `await p` waited
 * as long as the provider felt like taking, and a single hung provider stalled
 * the whole chain until the platform killed the function.
 *
 * Two mechanisms now, because one is not enough: the signal cancels a well-
 * behaved client, and the race rejects regardless in case a provider ignores it.
 */
function withTimeout<T>(make: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined

  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ctrl.abort()
      reject(new Error(`timed out after ${ms}ms`))
    }, ms)
  })

  return Promise.race([make(ctrl.signal), deadline]).finally(() => clearTimeout(timer))
}

/**
 * Run the provider chain. Each provider gets its own deadline plus one retry,
 * then we drop to the next. An empty completion counts as a failure — a model
 * that answers with nothing is no more useful than one that times out. Throws
 * only if EVERY provider fails; coachExplain catches that and uses the template.
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
          (signal) =>
            p.client.chat.completions.create(
              { model: p.model, messages, max_tokens: maxTokens, temperature, ...p.extra },
              { signal },
            ),
          p.timeoutMs ?? PROVIDER_TIMEOUT_MS,
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
export type ExplainKind = 'blunder' | 'good' | 'coach-move' | 'review' | 'position'
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
  /** 'position' only: the move the OPPONENT just played, as context. It is not
   *  an alternative to bestMoveSan — they belong to different sides, and saying
   *  "you should have played X instead of Y" across that boundary is nonsense. */
  opponentMoveSan?: string
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
      if (f.bestMoveSan) bits.push(`A stronger try is ${describeMove(f.bestMoveSan)}.`)
      if (lost != null && lost >= 1) bits.push(`It costs you ${pawnsLost(lost)}.`)
      return bits.join(' ')
    }
    case 'good': {
      const head = f.playerMoveSan
        ? `Good — ${describeMove(f.playerMoveSan)} is the right idea.`
        : 'Good — that\'s the right idea.'
      return f.concept ? `${head} You spotted the ${f.concept}.` : head
    }
    case 'coach-move': {
      const mine = f.playerMoveSan ? describeMove(f.playerMoveSan) : 'this'
      return f.detail ? `I'll play ${mine} — ${f.detail}.` : `I'll play ${mine}.`
    }
    case 'review': {
      const head = f.movesPlayed ? `Nice work over ${f.movesPlayed} moves.` : 'Nice work.'
      return f.concept ? `${head} Next, let's sharpen your ${f.concept}.` : `${head} Let's keep building.`
    }
    case 'position': {
      const bits: string[] = []
      if (f.evalDeltaCp != null) bits.push(`${sentence(describeEval(f.evalDeltaCp))}.`)
      else if (f.detail) bits.push(`${sentence(f.detail)}.`)
      if (f.bestMoveSan) bits.push(`I would play ${describeMove(f.bestMoveSan)}.`)
      if (f.concept) bits.push(`Watch for ${f.concept}.`)
      return bits.length ? bits.join(' ') : 'Nothing forcing here. Improve your worst piece.'
    }
  }
}

/** "1.4" points of advantage means nothing. Pawns do. */
function pawnsLost(pawns: number): string {
  const p = Math.abs(pawns)
  if (p < 1.25) return 'about a pawn'
  if (p < 1.75) return 'about a pawn and a half'
  const halves = Math.round(p * 2) / 2
  const whole = Math.floor(halves)
  const WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six']
  if (whole > 6) return 'a decisive amount'
  if (halves % 1 !== 0) return `about ${WORDS[whole]} and a half pawns`
  return `about ${WORDS[whole]} pawns`
}

/**
 * Produce a coach-voiced lesson. Tries the LLM chain; on any failure returns
 * the deterministic template. The chess content is identical either way —
 * only the wording degrades.
 */
export async function coachExplain(f: ExplainFacts): Promise<{ text: string; source: 'llm' | 'template' }> {
  const fallback = renderTemplate(f)
  if (providers().length === 0) return { text: fallback, source: 'template' }

  // Facts go over as finished English. Every value the model has to interpret
  // is a value it can interpret wrongly — handing it "Bc4" and "-27" is how it
  // produced "you should have played Nf6 instead of Bc4" and "costing you 27
  // centipawns". It is given sentences now, and its only remaining job is to
  // perform them in character.
  const facts = (
    f.kind === 'position'
      ? [
          `Coach: ${f.coachName}`,
          `Student level: ${f.learnerLevel}`,
          'Situation: the student has asked what you think of the position they are about to move in',
          f.opponentMoveSan && `Your opponent just played ${describeMove(f.opponentMoveSan)}.`,
          f.bestMoveSan && `The strongest move for you here is ${describeMove(f.bestMoveSan)}.`,
          f.evalDeltaCp != null && `${sentence(describeEval(f.evalDeltaCp))}.`,
          f.concept && `Note: ${f.concept}.`,
          f.detail && `Engine note: ${f.detail}.`,
          'Advise them on THIS position. Nothing has been lost or blundered — do not scold them for a move they have not made.',
          'Name pieces in words the way the facts above do (for example "Knight to f6"), not in notation.',
        ]
      : [
          `Coach: ${f.coachName}`,
          `Student level: ${f.learnerLevel}`,
          `Situation: ${f.kind}`,
          f.playerMoveSan && `The student played ${describeMove(f.playerMoveSan)}.`,
          f.bestMoveSan && `The stronger move was ${describeMove(f.bestMoveSan)}.`,
          f.evalDeltaCp != null && `That cost them ${describeEval(-Math.abs(f.evalDeltaCp)).replace(/^you are /, '').replace(/ behind.*$/, '')}.`,
          f.concept && `Concept: ${f.concept}.`,
          f.detail && `Engine note: ${f.detail}.`,
          'Name pieces in words the way the facts above do (for example "Knight to f6"), not in notation.',
        ]
  ).filter(Boolean).join('\n')

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
