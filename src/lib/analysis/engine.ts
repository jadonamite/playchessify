/**
 * Stockfish analysis engine — the TRUTH source for the teaching system.
 *
 * Runs the single-threaded Stockfish 18 lite NNUE build as a classic web
 * worker from /public/engine (no bundler involvement, no SharedArrayBuffer /
 * COOP-COEP headers needed). Speaks UCI, exposes a serialized `analyze()`.
 *
 * This is *only* for analysis/teaching (is a move good, what's best, why).
 * The coach's own (deliberately gentle) moves still come from the homegrown
 * minimax in src/lib/chess-engine.ts.
 */

const ENGINE_URL = '/engine/stockfish-18-lite-single.js'

export interface AnalysisResult {
  /** Best move in UCI long algebraic, e.g. "e2e4", "e7e8q". */
  bestMove: string | null
  /** Principal variation as UCI moves. */
  pv: string[]
  /** Evaluation in centipawns, White's perspective (+ = White better). */
  whiteCp: number
  /** Evaluation in centipawns, from the side-to-move's perspective. */
  stmCp: number
  /** Mate distance if forced mate is seen (+ = side-to-move mates), else null. */
  mate: number | null
  /** Depth actually reached. */
  depth: number
}

export interface AnalyzeOptions {
  /** Search depth (deep for teaching truth). Ignored if movetime is set. */
  depth?: number
  /** Fixed thinking time in ms (alternative to depth). */
  movetime?: number
}

type Resolver = (r: AnalysisResult) => void

class StockfishEngine {
  private worker: Worker | null = null
  private ready: Promise<void> | null = null
  private queue: Promise<unknown> = Promise.resolve()

  // Per-search accumulators (one search runs at a time, serialized via queue).
  private pending: Resolver | null = null
  private latest: Omit<AnalysisResult, 'bestMove'> = {
    pv: [], whiteCp: 0, stmCp: 0, mate: null, depth: 0,
  }
  private sideToMove: 1 | -1 = 1 // +1 white, -1 black — for White-POV conversion

  private ensureReady(): Promise<void> {
    if (this.ready) return this.ready
    this.ready = new Promise<void>((resolve, reject) => {
      if (typeof window === 'undefined') { reject(new Error('engine: browser only')); return }
      try {
        this.worker = new Worker(ENGINE_URL)
      } catch (e) {
        reject(e as Error); return
      }
      let booted: boolean = false
      this.worker.onmessage = (ev: MessageEvent) => {
        const line = typeof ev.data === 'string' ? ev.data : String(ev.data)
        if (!booted) {
          if (line.includes('uciok')) {
            this.send('isready')
          } else if (line.includes('readyok')) {
            booted = true
            resolve()
          }
          return
        }
        this.handleLine(line)
      }
      this.worker.onerror = (e) => reject(new Error(`engine worker error: ${e.message}`))
      this.send('uci')
    })
    return this.ready
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd)
  }

  private handleLine(line: string) {
    if (line.startsWith('info') && line.includes(' pv ')) {
      const depthM = line.match(/ depth (\d+)/)
      const cpM = line.match(/ score cp (-?\d+)/)
      const mateM = line.match(/ score mate (-?\d+)/)
      const pvM = line.match(/ pv (.+)$/)
      if (depthM) this.latest.depth = Number(depthM[1])
      if (mateM) {
        this.latest.mate = Number(mateM[1])
        // Represent mate as a large cp so deltas stay comparable.
        const stm = (this.latest.mate > 0 ? 1 : -1) * (100000 - Math.abs(this.latest.mate))
        this.latest.stmCp = stm
        this.latest.whiteCp = stm * this.sideToMove
      } else if (cpM) {
        this.latest.mate = null
        const stm = Number(cpM[1])
        this.latest.stmCp = stm
        this.latest.whiteCp = stm * this.sideToMove
      }
      if (pvM) this.latest.pv = pvM[1].trim().split(/\s+/)
      return
    }
    if (line.startsWith('bestmove')) {
      const best = line.split(/\s+/)[1]
      const resolve = this.pending
      this.pending = null
      resolve?.({
        bestMove: best && best !== '(none)' ? best : null,
        pv: this.latest.pv,
        whiteCp: this.latest.whiteCp,
        stmCp: this.latest.stmCp,
        mate: this.latest.mate,
        depth: this.latest.depth,
      })
    }
  }

  /** Analyze a FEN. Serialized — concurrent calls run one after another. */
  analyze(fen: string, opts: AnalyzeOptions = {}): Promise<AnalysisResult> {
    const run = async (): Promise<AnalysisResult> => {
      await this.ensureReady()
      this.sideToMove = fen.split(' ')[1] === 'b' ? -1 : 1
      this.latest = { pv: [], whiteCp: 0, stmCp: 0, mate: null, depth: 0 }
      return new Promise<AnalysisResult>((resolve) => {
        this.pending = resolve
        this.send('ucinewgame')
        this.send(`position fen ${fen}`)
        this.send(opts.movetime ? `go movetime ${opts.movetime}` : `go depth ${opts.depth ?? 18}`)
      })
    }
    // Chain onto the queue so the single engine instance handles one search at a time.
    const result = this.queue.then(run, run)
    this.queue = result.catch(() => {})
    return result
  }

  dispose() {
    this.worker?.terminate()
    this.worker = null
    this.ready = null
  }
}

let singleton: StockfishEngine | null = null

/** Lazily-created shared engine instance (one worker for the whole app). */
export function getEngine(): StockfishEngine {
  if (!singleton) singleton = new StockfishEngine()
  return singleton
}
