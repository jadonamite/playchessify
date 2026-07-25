'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getEngine, type AnalysisResult, type AnalyzeOptions } from '@/lib/analysis/engine'

const initializeEngine = async (mounted: React.MutableRefObject<boolean>, setReady: (ready: boolean) => void) => {
  try {
    await getEngine().analyze('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', { depth: 1 })
    if (mounted.current) setReady(true)
  } catch (error) {
    // engine unavailable — teaching falls back to non-analysis paths
  }
}

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
    initializeEngine(mounted, setReady)
    return () => { mounted.current = false }
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