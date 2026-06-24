// Audio engine — two persistent MP3 tracks + Web Audio API move sounds
// Landing/lobby: mondamusic-lofi-lofi-girl-lofi-music-529555.mp3
// Game:          mondamusic-lofi-lofi-girl-lofi-chill-512853.mp3

const LANDING_TRACK = '/music/mondamusic-lofi-lofi-girl-lofi-music-529555.mp3'
const GAME_TRACK    = '/music/mondamusic-lofi-lofi-girl-lofi-chill-512853.mp3'

type TrackId = 'landing' | 'game'

interface Track {
  audio: HTMLAudioElement
  fadeTimer: ReturnType<typeof setInterval> | null
}

const tracks: Record<TrackId, Track | null> = { landing: null, game: null }
let activeTrack: TrackId | null = null

function getTrack(id: TrackId): Track {
  if (tracks[id]) return tracks[id]!
  const audio = new Audio(id === 'game' ? GAME_TRACK : LANDING_TRACK)
  audio.loop = true
  audio.volume = 0
  const t: Track = { audio, fadeTimer: null }
  tracks[id] = t
  return t
}

function fadeTo(track: Track, target: number, durationMs: number, onDone?: () => void) {
  if (track.fadeTimer) clearInterval(track.fadeTimer)
  const start = track.audio.volume
  const delta = target - start
  const steps = Math.max(1, Math.round(durationMs / 30))
  let step = 0
  track.fadeTimer = setInterval(() => {
    step++
    track.audio.volume = Math.min(1, Math.max(0, start + delta * (step / steps)))
    if (step >= steps) {
      clearInterval(track.fadeTimer!)
      track.fadeTimer = null
      onDone?.()
    }
  }, 30)
}

function startTrack(id: TrackId, volume = 0.55) {
  const track = getTrack(id)
  if (track.audio.paused) {
    track.audio.play().catch(() => {})
  }
  fadeTo(track, volume, 2500)
  activeTrack = id
}

function stopTrack(id: TrackId, durationMs = 1200) {
  const track = tracks[id]
  if (!track || track.audio.paused) return
  fadeTo(track, 0, durationMs, () => {
    track.audio.pause()
    track.audio.currentTime = 0
  })
}

// ─── public API ─────────────────────────────────────────────────────────────

export function startAmbient() {
  if (activeTrack === 'landing') return
  stopTrack('game', 800)
  startTrack('landing', 0.55)
}

export function startGameTrack() {
  if (activeTrack === 'game') return
  stopTrack('landing', 800)
  startTrack('game', 0.5)
}

export function stopAmbient() {
  stopTrack('landing')
  stopTrack('game')
  activeTrack = null
}

export function setMuted(muted: boolean) {
  if (muted) {
    Object.values(tracks).forEach(t => { if (t) t.audio.volume = 0 })
  } else if (activeTrack) {
    const vol = activeTrack === 'game' ? 0.5 : 0.55
    const track = tracks[activeTrack]
    if (track) fadeTo(track, vol, 800)
  }
}

// ─── move sound (Web Audio API) ─────────────────────────────────────────────

/**
 * noiseBuf
 * @param {*} ctx: AudioContext
 * @returns {*}
 */
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
