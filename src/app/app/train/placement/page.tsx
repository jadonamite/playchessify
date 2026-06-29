'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Chess } from 'chess.js'
import TrainingBoard from '@/components/train/TrainingBoard'
import { useAnalysis } from '@/hooks/useAnalysis'
import { useLearner } from '@/hooks/useLearner'
import { PLACEMENT, scorePlacement, type PlacementItem } from '@/config/placement'
import TrapButton from '@/components/train/TrapButton'

type Phase = 'solving' | 'judging' | 'feedback' | 'done'

export default function PlacementPage() {
  const router = useRouter()
  const { analyze, ready } = useAnalysis()
  const { update } = useLearner()

  const [idx, setIdx] = useState(0)
  const [game, setGame] = useState(() => new Chess(PLACEMENT[0].fen))
  const [phase, setPhase] = useState<Phase>('solving')
  const [results, setResults] = useState<{ item: PlacementItem; solved: boolean }[]>([])
  const [lastSolved, setLastSolved] = useState(false)
  const [saving, setSaving] = useState(false)

  const item = PLACEMENT[idx]

  /** Judge a move with Stockfish: exact best, or within ~0.6 pawns of best. */
  const judge = useCallback(async (uci: string): Promise<boolean> => {
    const pre = await analyze(item.fen, { depth: 12 })
    if (!pre) return uci === item.expectedUci // engine down → fall back to key
    if (pre.bestMove === uci) return true
    const g = new Chess(item.fen)
    const move = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: 'q' })
    if (!move) return false
    const post = await analyze(g.fen(), { depth: 12 })
    if (!post) return uci === item.expectedUci
    return pre.whiteCp - post.whiteCp <= 60
  }, [analyze, item])

  const onMove = useCallback((from: string, to: string): boolean => {
    if (phase !== 'solving') return false
    const probe = new Chess(item.fen)
    const move = probe.move({ from, to, promotion: 'q' })
    if (!move) return false
    setGame(probe)
    setPhase('judging')
    void (async () => {
      const solved = await judge(from + to)
      setLastSolved(solved)
      setResults((r) => [...r, { item, solved }])
      setPhase('feedback')
    })()
    return true
  }, [phase, item, judge])

  const next = useCallback(async () => {
    if (idx + 1 < PLACEMENT.length) {
      const n = idx + 1
      setIdx(n)
      setGame(new Chess(PLACEMENT[n].fen))
      setPhase('solving')
      return
    }
    // Finished — score, seed the learner model, route to the hub.
    setPhase('done')
    setSaving(true)
    const outcome = scorePlacement(results)
    try {
      await update({ placed: true, level: outcome.level, concepts: outcome.concepts })
    } catch { /* not connected / sign declined — placement still completes locally */ }
    router.replace('/app/train')
  }, [idx, results, update, router])

  const solvedCount = results.filter((r) => r.solved).length
  const accent = lastSolved ? '#34d399' : '#fb7185'

  const board = useMemo(() => (
    <TrainingBoard
      game={game}
      orientation="white"
      interactive={phase === 'solving'}
      onMove={onMove}
    />
  ), [game, phase, onMove])

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-300/80">Placement</div>
          <h1 className="font-bold text-xl text-white">Where do you stand?</h1>
        </div>
        <div className="text-right text-sm text-slate-400">
          {idx + 1}/{PLACEMENT.length}
          <div className="text-emerald-400">{solvedCount} solved</div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0a1220]/80 p-3">
        {board}
      </div>

      <div className="mt-4 min-h-[92px] rounded-xl border p-4 text-slate-200"
           style={{ borderColor: phase === 'feedback' ? accent + '66' : 'rgba(255,255,255,0.1)' }}>
        {phase === 'solving' && (
          <p className="text-[15px]">{item.prompt}{!ready && <span className="ml-2 text-xs text-slate-500">(engine warming…)</span>}</p>
        )}
        {phase === 'judging' && <p className="text-slate-400">Checking your move…</p>}
        {phase === 'feedback' && (
          <div>
            <p className="font-semibold" style={{ color: accent }}>
              {lastSolved ? 'Correct — well played.' : 'Not the strongest here.'}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {lastSolved ? 'That\'s the move.' : `The key idea was ${item.expectedUci.slice(0, 2)}→${item.expectedUci.slice(2, 4)}.`}
            </p>
          </div>
        )}
        {phase === 'done' && <p className="text-slate-300">{saving ? 'Saving your starting point…' : 'Done.'}</p>}
      </div>

      {phase === 'feedback' && (
        <div className="mt-4">
          <TrapButton onClick={next}>
            {idx + 1 < PLACEMENT.length ? 'Next position ▸' : 'See my level ▸'}
          </TrapButton>
        </div>
      )}
    </div>
  )
}
