#!/usr/bin/env node
/**
 * Stockfish in its own process, speaking JSON lines.
 *
 * It has to be its own process. The emscripten build assigns `fetch = null` on
 * the global when it detects Node — that is how it forces its own file-reading
 * shim for the .wasm — which removes fetch from whatever process hosts it and
 * breaks every later Upstash call in the same runtime. It also cannot be
 * initialised twice in one process: the second boot sees fetch restored, takes
 * the streaming-instantiate path against a filesystem path, and dies with a
 * WebAssembly LinkError.
 *
 * Both problems disappear when the engine owns its process.
 *
 * Protocol, one JSON object per line:
 *   in   { id, fen, movetime }
 *   out  { id, bestMove, cp, mate, depth, pv }  |  { id, error }
 */
const initEngine = require('stockfish')

let engine = null
let current = null

function reply(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

function onLine(line) {
  if (!current) return
  if (line.startsWith('info') && line.includes(' pv ')) {
    const d = line.match(/ depth (\d+)/)
    if (d) current.depth = Number(d[1])
    const m = line.match(/ score mate (-?\d+)/)
    const c = line.match(/ score cp (-?\d+)/)
    if (m) { current.mate = Number(m[1]); current.cp = null }
    else if (c) { current.cp = Number(c[1]); current.mate = null }
    const p = line.match(/ pv (.+)$/)
    if (p) current.pv = p[1].trim().split(/\s+/).slice(0, 8)
    return
  }
  if (line.startsWith('bestmove')) {
    const best = line.split(/\s+/)[1]
    const done = current
    current = null
    reply({
      id: done.id,
      bestMove: best && best !== '(none)' ? best : null,
      cp: done.cp,
      mate: done.mate,
      depth: done.depth,
      pv: done.pv,
    })
  }
}

async function boot() {
  engine = await initEngine('lite-single')
  engine.listener = (line) => onLine(String(line))
  reply({ ready: true })
}

let buffer = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  buffer += chunk
  let nl
  while ((nl = buffer.indexOf('\n')) >= 0) {
    const raw = buffer.slice(0, nl).trim()
    buffer = buffer.slice(nl + 1)
    if (!raw) continue
    let req
    try { req = JSON.parse(raw) } catch { continue }
    if (!engine) { reply({ id: req.id, error: 'engine not ready' }); continue }
    if (current) { reply({ id: req.id, error: 'busy' }); continue }
    current = { id: req.id, cp: null, mate: null, depth: 0, pv: [] }
    engine.sendCommand('ucinewgame')
    engine.sendCommand('position fen ' + req.fen)
    engine.sendCommand('go movetime ' + (req.movetime || 400))
  }
})

boot().catch((err) => {
  reply({ fatal: String((err && err.message) || err) })
  process.exit(1)
})
