import path from 'node:path'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'

/**
 * Stockfish on the server, in a process of its own.
 *
 * The browser engine (lib/analysis/engine.ts) stays where it is — it drives
 * training hints and costs nothing. Anything METERED has to be computed here,
 * because a cap over an engine running in the player's own tab is decoration:
 * open devtools, talk to the worker, and the analysis is free and unlimited.
 *
 * Why a child process and not an import. The emscripten build assigns
 * `fetch = null` on the global when it detects Node, to force its own file
 * shim for loading the .wasm. In-process that removes fetch from the whole
 * runtime, and every later Upstash call — the ask meter included — fails with
 * "fetch is not a function". Restoring fetch afterwards is worse: the engine's
 * next boot then takes the streaming-instantiate path against a filesystem
 * path and aborts with a WebAssembly LinkError, taking the server with it.
 * Both were observed, in that order. The engine gets its own process.
 */

export interface ServerAnalysis {
  bestMove: string | null
  /** Centipawns from WHITE's perspective. */
  whiteCp: number
  /** Mate distance if forced mate is seen (+ = side to move mates). */
  mate: number | null
  depth: number
  pv: string[]
}

interface HostReply {
  id?: number
  bestMove?: string | null
  cp?: number | null
  mate?: number | null
  depth?: number
  pv?: string[]
  ready?: boolean
  error?: string
  fatal?: string
}

const HOST_SCRIPT = path.join(process.cwd(), 'tools', 'stockfish-host.cjs')
const BOOT_TIMEOUT_MS = 15_000
const SEARCH_TIMEOUT_MS = 12_000
const DEFAULT_MOVETIME = 400

let child: ChildProcessWithoutNullStreams | null = null
let ready: Promise<void> | null = null
let nextId = 1
const waiting = new Map<number, (r: HostReply) => void>()

function kill() {
  waiting.forEach((resolve, id) => resolve({ id, error: 'engine restarted' }))
  waiting.clear()
  try { child?.kill() } catch { /* already gone */ }
  child = null
  ready = null
}

function start(): Promise<void> {
  if (ready) return ready

  ready = new Promise<void>((resolve, reject) => {
    const proc = spawn(process.execPath, [HOST_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    })
    child = proc

    const bootTimer = setTimeout(() => {
      kill()
      reject(new Error('stockfish host did not become ready'))
    }, BOOT_TIMEOUT_MS)

    let buffer = ''
    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (chunk: string) => {
      buffer += chunk
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        // The engine prints a banner before the protocol starts. Anything that
        // is not JSON is engine chatter, not a reply.
        if (!line.startsWith('{')) continue
        let msg: HostReply
        try { msg = JSON.parse(line) as HostReply } catch { continue }

        if (msg.ready) { clearTimeout(bootTimer); resolve(); continue }
        if (msg.fatal) { clearTimeout(bootTimer); kill(); reject(new Error(msg.fatal)); continue }
        if (typeof msg.id === 'number') {
          waiting.get(msg.id)?.(msg)
          waiting.delete(msg.id)
        }
      }
    })

    proc.stderr.on('data', (d: Buffer) => {
      const s = d.toString().trim()
      if (s) console.warn('[stockfish-host]', s.slice(0, 200))
    })

    // A dead engine must not leave callers hanging, and the next request should
    // get a fresh one rather than a permanently broken singleton.
    proc.on('exit', (code) => {
      console.warn('[stockfish-host] exited', code)
      clearTimeout(bootTimer)
      kill()
    })
    proc.on('error', (err) => {
      clearTimeout(bootTimer)
      kill()
      reject(err)
    })
  }).catch((err) => {
    ready = null
    throw err
  })

  return ready
}

export async function analyzeOnServer(fen: string, movetime = DEFAULT_MOVETIME): Promise<ServerAnalysis | null> {
  try {
    await start()
  } catch (err) {
    console.error('[server-engine] boot failed:', (err as Error)?.message)
    return null
  }
  const proc = child
  if (!proc) return null

  const id = nextId++
  const reply = await new Promise<HostReply>((resolve) => {
    const timer = setTimeout(() => {
      waiting.delete(id)
      // A search that never reported back means the host is wedged. Replace it
      // rather than let every later request queue behind a dead engine.
      kill()
      resolve({ id, error: 'search timed out' })
    }, SEARCH_TIMEOUT_MS)

    waiting.set(id, (r) => { clearTimeout(timer); resolve(r) })
    proc.stdin.write(JSON.stringify({ id, fen, movetime }) + '\n')
  })

  if (reply.error || reply.bestMove === undefined) return null

  // The host reports from the side to move; callers want White's perspective.
  const stm = fen.split(' ')[1] === 'b' ? -1 : 1
  const whiteCp =
    reply.mate != null
      ? (reply.mate > 0 ? 1 : -1) * (100000 - Math.abs(reply.mate)) * stm
      : (reply.cp ?? 0) * stm

  return {
    bestMove: reply.bestMove ?? null,
    whiteCp,
    mate: reply.mate ?? null,
    depth: reply.depth ?? 0,
    pv: reply.pv ?? [],
  }
}
