let _ambientOscs: OscillatorNode[] = []
let _ambientMaster: GainNode | null = null

export function playMoveChime(ctx: AudioContext, isOpponent = false) {
  if (ctx.state === 'suspended') ctx.resume()
  const t = ctx.currentTime
  const freq = isOpponent ? 622.25 : 880 // Eb5 for opponent, A5 for self

  const osc = ctx.createOscillator()
  const env = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, t)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.82, t + 0.12)

  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(0.25, t + 0.012)
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.65)

  osc.connect(env)
  env.connect(ctx.destination)
  osc.start(t)
  osc.stop(t + 0.7)
}

export function startAmbient(ctx: AudioContext) {
  if (_ambientOscs.length > 0) return
  if (ctx.state === 'suspended') ctx.resume()

  const master = ctx.createGain()
  master.gain.setValueAtTime(0, ctx.currentTime)
  master.gain.linearRampToValueAtTime(0.065, ctx.currentTime + 3.5)
  master.connect(ctx.destination)
  _ambientMaster = master

  // A minor drone: A2, E3, A3, C4
  const FREQS = [110, 164.81, 220, 261.63]
  const TYPES: OscillatorType[] = ['sawtooth', 'sine', 'sine', 'triangle']

  FREQS.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()

    osc.type = TYPES[i]
    osc.frequency.value = freq

    lfo.type = 'sine'
    lfo.frequency.value = 0.07 + i * 0.02
    lfoGain.gain.value = 0.15
    lfo.connect(lfoGain)
    lfoGain.connect(gain.gain)

    gain.gain.value = 0.22 / (i + 1)
    osc.connect(gain)
    gain.connect(master)

    lfo.start()
    osc.start()

    _ambientOscs.push(osc, lfo)
  })
}

export function stopAmbient(ctx: AudioContext) {
  if (!_ambientMaster) return
  const t = ctx.currentTime
  _ambientMaster.gain.linearRampToValueAtTime(0, t + 1.5)
  const toStop = [..._ambientOscs]
  _ambientOscs = []
  _ambientMaster = null
  setTimeout(() => { toStop.forEach(n => { try { n.stop() } catch {} }) }, 1600)
}
