'use client'

import type { ExplainFacts } from '@/lib/coach/voice'

/**
 * Client helper to fetch a coach-voiced lesson. The caller supplies engine
 * facts (already computed via useAnalysis). Never throws — on any failure it
 * returns the local template so the UI always has something to show.
 */
export async function fetchCoachVoice(
  facts: ExplainFacts & { fen?: string },
): Promise<{ text: string; source: 'llm' | 'template' }> {
  try {
    const res = await fetch('/api/coach/explain', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(facts),
    })
    if (!res.ok) throw new Error('explain failed')
    const data = await res.json()
    return { text: data.text, source: data.source }
  } catch {
    return { text: localTemplate(facts), source: 'template' }
  }
}

/** Minimal client-side mirror of the server template, for total-offline safety. */
function localTemplate(f: ExplainFacts): string {
  switch (f.kind) {
    case 'blunder':
      return [
        f.detail ? `Careful — ${f.detail}.` : 'Careful — that move gives something away.',
        f.bestMoveSan ? `A stronger try is ${f.bestMoveSan}.` : '',
      ].filter(Boolean).join(' ')
    case 'good':
      return f.playerMoveSan ? `Good — ${f.playerMoveSan} is the right idea.` : 'Good — that\'s the right idea.'
    case 'coach-move':
      return f.playerMoveSan ? `I'll play ${f.playerMoveSan}.` : 'My move.'
    case 'review':
      return 'Nice work — let\'s keep building.'
  }
}
