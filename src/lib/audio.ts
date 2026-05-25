// Audio engine — MP3 ambient track + Web Audio API move sounds
// Ambient: /music/mondamusic-lofi-lofi-girl-lofi-chill-512853.mp3 (looped)
// Move sounds: synthesised bandpass thud + sine sub

const TRACK_SRC = '/music/mondamusic-lofi-lofi-girl-lofi-chill-512853.mp3'

let _audio: HTMLAudioElement | null = null
let _fadeTimer: ReturnType<typeof setTimeout> | null = null

function getAudio(): HTMLAudioElement {
  if (!_audio) {
    _audio = new Audio(TRACK_SRC)
    _audio.loop = true
    _audio.volume = 0
  }
  return _audio
}

function fadeTo(target: number, durationMs: number) {
  if (_fadeTimer) clearInterval(_fadeTimer)
  const audio = getAudio()
  const start = audio.volume
  const delta = target - start
  const steps = Math.max(1, Math.round(durationMs / 30))
  let step = 0
  _fadeTimer = setInterval(() => {
    step++
    audio.volume = Math.min(1, Math.max(0, start + delta * (step / steps)))
    if (step >= steps) {
      clearInterval(_fadeTimer!)
      _fadeTimer = null
      if (target === 0) {
        audio.pause()
        audio.currentTime = 0
      }
    }
  }, 30)
}

// ─── public API ─────────────────────────────────────────────────────────────

export function startAmbient(_ctx?: AudioContext) {
  const audio = getAudio()
  if (!audio.paused) return
  audio.play().catch(() => {})
  fadeTo(0.55, 3000)
}

export function startGameTrack(_ctx?: AudioContext) {
  const audio = getAudio()
  if (!audio.paused) return
  audio.play().catch(() => {})
  fadeTo(0.5, 2000)
}

export function stopAmbient(_ctx?: AudioContext) {
  if (!_audio || _audio.paused) return
  fadeTo(0, 1200)
}

// ─── move sound (Web Audio API) ─────────────────────────────────────────────

function noiseBuf(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate * 3
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return buf
}

export function playMoveSound(ctx: AudioContext, isOpponent = false) {
  if (ctx.state === 'suspended') ctx.resume()
  const t = ctx.currentTime
  const buf = noiseBuf(ctx)

  const ns = ctx.createBufferSource()
  ns.buffer = buf
  const nbp = ctx.createBiquadFilter()
  nbp.type = 'bandpass'
  nbp.frequency.value = isOpponent ? 280 : 340
  nbp.Q.value = 1.2
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(isOpponent ? 0.28 : 0.34, t)
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
  ns.connect(nbp); nbp.connect(ng); ng.connect(ctx.destination)
  ns.start(t); ns.stop(t + 0.14)

  const sub = ctx.createOscillator()
  const sg = ctx.createGain()
  sub.frequency.setValueAtTime(isOpponent ? 90 : 110, t)
  sub.frequency.exponentialRampToValueAtTime(40, t + 0.1)
  sg.gain.setValueAtTime(isOpponent ? 0.22 : 0.28, t)
  sg.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
  sub.connect(sg); sg.connect(ctx.destination)
  sub.start(t); sub.stop(t + 0.2)
}

export const playMoveChime = playMoveSound
