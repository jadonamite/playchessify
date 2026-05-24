// Lofi chess audio engine — Web Audio API, no external files
// Landing: 75 BPM, hi-hats + soft ghost snare + Am7 pads + bass + vinyl
// Game:    85 BPM, full kit (kick/snare/hihat) + bass + pads + vinyl, swing feel
// Piece hit: bandpass noise thud + sine sub

type TrackMode = 'landing' | 'game'

const LOOKAHEAD_SECS = 0.12
const TICK_MS = 50
const SWING = 0.018 // seconds pushed to off-beats for that lofi drag

interface EngineState {
  ctx: AudioContext | null
  master: GainNode | null
  mode: TrackMode | null
  nextNote: number
  beat: number          // 8th-note index
  timer: ReturnType<typeof setTimeout> | null
  noiseBuf: AudioBuffer | null
}

const E: EngineState = {
  ctx: null, master: null, mode: null,
  nextNote: 0, beat: 0, timer: null, noiseBuf: null,
}

// ─── helpers ────────────────────────────────────────────────────────────────

function getCtx(): AudioContext {
  if (!E.ctx) E.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  if (E.ctx.state === 'suspended') E.ctx.resume()
  return E.ctx
}

function noiseBuf(ctx: AudioContext): AudioBuffer {
  if (E.noiseBuf) return E.noiseBuf
  const len = ctx.sampleRate * 3
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  E.noiseBuf = buf
  return buf
}

function noise(ctx: AudioContext, dst: AudioNode, t: number, dur: number, gain: number) {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf(ctx)
  src.loopStart = Math.random() * 2
  src.loopEnd = src.loopStart + dur + 0.05
  src.loop = true
  const g = ctx.createGain()
  g.gain.setValueAtTime(gain, t)
  src.connect(g)
  g.connect(dst)
  src.start(t)
  src.stop(t + dur)
  return g
}

function osc(ctx: AudioContext, type: OscillatorType, freq: number, dst: AudioNode, t: number, dur: number, gain: number) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  g.gain.setValueAtTime(gain, t)
  o.connect(g)
  g.connect(dst)
  o.start(t)
  o.stop(t + dur)
  return g
}

function bp(ctx: AudioContext, freq: number, q: number): BiquadFilterNode {
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = freq
  f.Q.value = q
  return f
}

function hp(ctx: AudioContext, freq: number): BiquadFilterNode {
  const f = ctx.createBiquadFilter()
  f.type = 'highpass'
  f.frequency.value = freq
  return f
}

// ─── drum synthesis ─────────────────────────────────────────────────────────

function kick(ctx: AudioContext, dst: AudioNode, t: number, vel = 1.0) {
  const env = ctx.createGain()
  env.connect(dst)
  // sine sweep
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(140, t)
  o.frequency.exponentialRampToValueAtTime(40, t + 0.07)
  const og = ctx.createGain()
  og.gain.setValueAtTime(vel * 0.85, t)
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.32)
  o.connect(og); og.connect(dst)
  o.start(t); o.stop(t + 0.35)
  // click transient
  const ns = ctx.createBufferSource()
  ns.buffer = noiseBuf(ctx)
  const nbp = bp(ctx, 280, 0.8)
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(vel * 0.18, t)
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.035)
  ns.connect(nbp); nbp.connect(ng); ng.connect(dst)
  ns.start(t); ns.stop(t + 0.04)
}

function snare(ctx: AudioContext, dst: AudioNode, t: number, vel = 1.0) {
  // tonal body
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(220, t)
  o.frequency.exponentialRampToValueAtTime(90, t + 0.1)
  const og = ctx.createGain()
  og.gain.setValueAtTime(vel * 0.45, t)
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.14)
  o.connect(og); og.connect(dst)
  o.start(t); o.stop(t + 0.16)
  // snappy noise
  const ns = ctx.createBufferSource()
  ns.buffer = noiseBuf(ctx)
  const nbp = bp(ctx, 3200, 1.2)
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(vel * 0.38, t)
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
  ns.connect(nbp); nbp.connect(ng); ng.connect(dst)
  ns.start(t); ns.stop(t + 0.22)
}

function hihat(ctx: AudioContext, dst: AudioNode, t: number, open = false, vel = 1.0) {
  const ns = ctx.createBufferSource()
  ns.buffer = noiseBuf(ctx)
  const nhp = hp(ctx, 6800)
  const dec = open ? 0.22 : 0.055
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(vel * 0.16, t)
  ng.gain.exponentialRampToValueAtTime(0.001, t + dec)
  ns.connect(nhp); nhp.connect(ng); ng.connect(dst)
  ns.start(t); ns.stop(t + dec + 0.01)
}

// ─── melodic synthesis ───────────────────────────────────────────────────────

// Am7: A2, C3, E3, G3 in Hz
const PAD_FREQS = [110, 130.81, 164.81, 196]
// Simple 8-beat bassline (Am pattern, mixolydian flavour)
const BASS_NOTES = [55, 55, 65.41, 55, 55, 73.42, 65.41, 55]

function pad(ctx: AudioContext, dst: AudioNode, t: number, dur: number) {
  // Low-pass filtered triangle — warm lofi pad
  const filt = ctx.createBiquadFilter()
  filt.type = 'lowpass'
  filt.frequency.value = 800
  filt.Q.value = 0.7
  filt.connect(dst)
  PAD_FREQS.forEach((freq, i) => {
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = freq + (Math.random() - 0.5) * 0.6 // slight detuning for warmth
    const g = ctx.createGain()
    const vol = 0.06 / (i * 0.5 + 1)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.6)
    g.gain.setValueAtTime(vol, t + dur - 0.5)
    g.gain.linearRampToValueAtTime(0, t + dur)
    o.connect(g); g.connect(filt)
    o.start(t); o.stop(t + dur + 0.1)
  })
}

function bassNote(ctx: AudioContext, dst: AudioNode, t: number, freq: number, dur: number) {
  const o = ctx.createOscillator()
  o.type = 'sawtooth'
  o.frequency.value = freq
  const filt = ctx.createBiquadFilter()
  filt.type = 'lowpass'
  filt.frequency.value = 400
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.28, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.82)
  o.connect(filt); filt.connect(g); g.connect(dst)
  o.start(t); o.stop(t + dur)
}

function vinylCrackle(ctx: AudioContext, dst: AudioNode, t: number) {
  if (Math.random() > 0.18) return
  const ns = ctx.createBufferSource()
  ns.buffer = noiseBuf(ctx)
  const g = ctx.createGain()
  const offset = Math.random() * 0.06
  const vol = 0.025 + Math.random() * 0.025
  g.gain.setValueAtTime(vol, t + offset)
  g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.012)
  ns.connect(g); g.connect(dst)
  ns.start(t + offset); ns.stop(t + offset + 0.015)
}

// ─── scheduler ──────────────────────────────────────────────────────────────

function scheduleBeat(ctx: AudioContext, dst: AudioNode, mode: TrackMode, t: number, beat8: number) {
  const bpm = mode === 'game' ? 85 : 75
  const step = 60 / bpm / 2             // 8th note duration
  const isOff = beat8 % 2 === 1         // off-beat 8th notes
  const tSwing = t + (isOff ? SWING : 0) // push off-beats for shuffle feel

  // Velocity humanisation
  const vel = () => 0.7 + Math.random() * 0.3

  // Hi-hat on every 8th (open on beat 3 and 7 sometimes)
  const openHat = (beat8 === 2 || beat8 === 6) && Math.random() > 0.6
  hihat(ctx, dst, tSwing, openHat, vel() * 0.8)

  if (mode === 'game') {
    // Kick: beat 0 (strong) and beat 4 (ghost)
    if (beat8 === 0) kick(ctx, dst, t, vel())
    if (beat8 === 4 && Math.random() > 0.4) kick(ctx, dst, t, vel() * 0.55)
    // Snare: beat 2 and 6
    if (beat8 === 2 || beat8 === 6) snare(ctx, dst, tSwing, vel())
    // Ghost snare rolls
    if ((beat8 === 3 || beat8 === 7) && Math.random() > 0.75) snare(ctx, dst, tSwing, vel() * 0.18)
  } else {
    // Landing: ghost snare only on 2 and 6
    if (beat8 === 2 || beat8 === 6) snare(ctx, dst, tSwing, vel() * 0.22)
  }

  // Bass note on even 8th notes (quarter note pulse)
  if (beat8 % 2 === 0) {
    const noteIdx = Math.floor(beat8 / 2)
    bassNote(ctx, dst, t, BASS_NOTES[noteIdx] ?? 55, step * 1.9)
  }

  // Pad: start a new pad block every 16 beats (2 bars) on beat 0
  if (beat8 === 0) {
    const barsOf8 = mode === 'game' ? 16 : 16
    pad(ctx, dst, t, step * barsOf8)
  }

  // Vinyl crackle: sprinkle randomly
  vinylCrackle(ctx, dst, t)
}

function runScheduler() {
  if (!E.ctx || !E.master || !E.mode) return
  const ctx = E.ctx

  // Schedule any beats that fall within the lookahead window
  while (E.nextNote < ctx.currentTime + LOOKAHEAD_SECS) {
    const bpm = E.mode === 'game' ? 85 : 75
    const step = 60 / bpm / 2
    const beat8 = E.beat % 16

    scheduleBeat(ctx, E.master, E.mode, E.nextNote, beat8)

    E.beat++
    E.nextNote += step
  }

  E.timer = setTimeout(runScheduler, TICK_MS)
}

// ─── public API ─────────────────────────────────────────────────────────────

export function startAmbient(ctx: AudioContext) {
  // landing track
  if (E.mode === 'landing') return
  stopAmbient(ctx)

  E.ctx = ctx
  const master = ctx.createGain()
  master.gain.setValueAtTime(0, ctx.currentTime)
  master.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 3)
  master.connect(ctx.destination)
  E.master = master
  E.mode = 'landing'
  E.nextNote = ctx.currentTime + 0.1
  E.beat = 0

  if (E.timer) clearTimeout(E.timer)
  runScheduler()
}

export function startGameTrack(ctx: AudioContext) {
  if (E.mode === 'game') return
  stopAmbient(ctx)

  E.ctx = ctx
  const master = ctx.createGain()
  master.gain.setValueAtTime(0, ctx.currentTime)
  master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2)
  master.connect(ctx.destination)
  E.master = master
  E.mode = 'game'
  E.nextNote = ctx.currentTime + 0.1
  E.beat = 0

  if (E.timer) clearTimeout(E.timer)
  runScheduler()
}

export function stopAmbient(_ctx?: AudioContext) {
  if (E.timer) { clearTimeout(E.timer); E.timer = null }
  if (E.master && E.ctx) {
    const t = E.ctx.currentTime
    E.master.gain.cancelScheduledValues(t)
    E.master.gain.setValueAtTime(E.master.gain.value, t)
    E.master.gain.linearRampToValueAtTime(0, t + 1.2)
  }
  E.master = null
  E.mode = null
  E.beat = 0
}

export function playMoveSound(ctx: AudioContext, isOpponent = false) {
  if (ctx.state === 'suspended') ctx.resume()
  const t = ctx.currentTime

  // Bandpass noise thud — piece hitting the board
  const ns = ctx.createBufferSource()
  ns.buffer = noiseBuf(ctx)
  const nbp = ctx.createBiquadFilter()
  nbp.type = 'bandpass'
  nbp.frequency.value = isOpponent ? 280 : 340
  nbp.Q.value = 1.2
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(isOpponent ? 0.28 : 0.34, t)
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
  ns.connect(nbp); nbp.connect(ng); ng.connect(ctx.destination)
  ns.start(t); ns.stop(t + 0.14)

  // Sub thud
  const sub = ctx.createOscillator()
  const sg = ctx.createGain()
  sub.frequency.setValueAtTime(isOpponent ? 90 : 110, t)
  sub.frequency.exponentialRampToValueAtTime(40, t + 0.1)
  sg.gain.setValueAtTime(isOpponent ? 0.22 : 0.28, t)
  sg.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
  sub.connect(sg); sg.connect(ctx.destination)
  sub.start(t); sub.stop(t + 0.2)
}

// Backwards-compat alias (GameClient calls playMoveChime)
export const playMoveChime = playMoveSound
