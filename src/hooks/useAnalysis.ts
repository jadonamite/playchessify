'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getEngine, type AnalysisResult, type AnalyzeOptions } from '@/lib/analysis/engine'

/**
 * React wrapper over the shared Stockfish engine. Returns a stable `analyze`
 * and live `analyzing` flag. The worker is shared app-wide; this hook does not
 * tear it down on unmount (other consumers may still need it).
 */
export function useAnalysis() {
  const [analyzing, setAnalyzing] = useState(false)
  const [ready, setReady] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    // Warm the engine so the first real analysis isn't paying boot cost.
    getEngine().analyze('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', { depth: 1 })
      .then(() => { if (mounted.current) setReady(true) })
      .catch(() => { /* engine unavailable — teaching falls back to non-analysis paths */ })
    return () => { mounted.current = false },
  }, [])

  const analyze = useCallback(async (fen: string, opts?: AnalyzeOptions): Promise<AnalysisResult | null> => {
    setAnalyzing(true)
    try {
      return await getEngine().analyze(fen, opts)
    } catch {
      return null
    } finally {
      if (mounted.current) setAnalyzing(false)
    }
  }, [])

  return { analyze, analyzing, ready }
}
