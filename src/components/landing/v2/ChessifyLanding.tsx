'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Canvas } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { King } from '@/components/ui/ChessModels'
import { useWallet } from '@/components/wallet-provider'
import GlowButton from '@/components/ui/GlowButton'
import { startAmbient, stopAmbient, setMuted } from '@/lib/audio'

/* ───────────────────────── helpers ───────────────────────── */

// Parse a CSS declaration string into a React style object so the design's
// dynamically-built style strings can be ported close to verbatim.
function css(s: string): React.CSSProperties {
  const o: Record<string, string> = {}
  s.split(';').forEach((rule) => {
    const i = rule.indexOf(':')
    if (i === -1) return
    const k = rule.slice(0, i).trim()
    const v = rule.slice(i + 1).trim()
    if (!k) return
    o[k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = v
  })
  return o as React.CSSProperties
}

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  return `rgba(${parseInt(h.substr(0, 2), 16)},${parseInt(h.substr(2, 2), 16)},${parseInt(h.substr(4, 2), 16)},${a})`
}

const PIECE_SET = '/pieces/maestro'

/* ───────────────────────── data ───────────────────────── */

type Coach = {
  id: string
  name: string
  title: string
  elo: number
  accent: string
  rarity: string
  tags: string
  piece: string // white piece svg file (w/o ext) used as our own art
  about: string
}

const COACHES: Coach[] = [
  { id: 'cipher', name: 'Cipher', title: 'The Tactician', elo: 2720, accent: '#22d3ee', rarity: 'LEGENDARY', tags: 'Sharp · Calculating · Universal', piece: 'wN', about: 'Cipher sees the board as a web of threats. Train with Cipher to set deep traps, calculate clean lines three moves ahead, and punish every inaccuracy your opponent makes.' },
  { id: 'magna', name: 'Magna', title: 'The Attacker', elo: 2700, accent: '#fb7185', rarity: 'LEGENDARY', tags: 'Aggressive · Tactical · Bold', piece: 'wQ', about: 'Magna hunts the enemy king from move one. Learn to seize the initiative, sacrifice for a roaring attack, and turn relentless pressure into checkmate.' },
  { id: 'sol', name: 'Sol', title: 'The Strategist', elo: 2740, accent: '#a78bfa', rarity: 'MYTHIC', tags: 'Positional · Patient · Precise', piece: 'wB', about: 'Sol owns the board before a single piece falls. Master pawn structures, trade into commanding squares, and squeeze your opponent until the position collapses.' },
  { id: 'vera', name: 'Vera', title: 'The Endgame', elo: 2680, accent: '#34d399', rarity: 'EPIC', tags: 'Technical · Cool · Relentless', piece: 'wK', about: 'Two pawns and a plan is all Vera needs. Sharpen your king activity, calculate to the last move, and convert winning endgames with surgical precision.' },
  { id: 'blitz', name: 'Blitz', title: 'The Speedster', elo: 2660, accent: '#fbbf24', rarity: 'RARE', tags: 'Blitz · Bullet · Instinct', piece: 'wP', about: 'Blitz thinks fast and moves faster. Build razor instincts, premove with purpose, and flag your opponent before they ever find the right idea.' },
  { id: 'nova', name: 'Nova', title: 'The Prodigy', elo: 2710, accent: '#60a5fa', rarity: 'EPIC', tags: 'Creative · Fearless · Modern', piece: 'wR', about: 'Nova plays the bold, modern lines top engines love. Train to break the rules with purpose, create chaos your rivals cannot read, and win from the wildest positions.' },
  { id: 'onyx', name: 'Onyx', title: 'The Maverick', elo: 2735, accent: '#f472b6', rarity: 'MYTHIC', tags: 'Unorthodox · Sharp · Daring', piece: 'wB', about: 'Onyx drags opponents into uncharted territory. Learn surprise openings, off-book traps, and the art of making every game a fight on your terms.' },
]

type Mode = { accent: string; tag: string; title: string; desc: string; piece: string }
const MODES: Mode[] = [
  { accent: '#22d3ee', tag: 'Casual', title: 'QUICK MATCH', desc: 'Jump in with zero stakes. Warm up, learn combos, and find your rhythm.', piece: 'wP' },
  { accent: '#7c9cff', tag: 'Ranked', title: 'WAGER MODE', desc: 'Stake CHESS, climb the Elo ladder, and the winner takes the entire pot.', piece: 'wQ' },
  { accent: '#fbbf24', tag: 'Seasonal', title: 'TOURNAMENTS', desc: 'Bracketed seasons with real prize pools. Outlast everyone for eternal glory.', piece: 'wK' },
]

const GLYPH: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }

/* ── 'Plays nice with' bento — full-width grid of square tiles that map out
   randomly: real partner logos (public/Supports), brand-accent color squares,
   and empty cells, mirroring the reference layout. ── */
const SUP = {
  minipay: { src: '/Supports/minipay-logo.svg', name: 'MiniPay' },
  celo: { src: '/Supports/celo.svg', name: 'Celo' },
  metamask: { src: '/Supports/MetaMask.svg', name: 'MetaMask' },
  privy: { src: '/Supports/privy-logo.png', name: 'Privy' },
}
type BCell = { k: 'head' | 'e' | 'a' | 'logo' | 'feat'; c?: string; logo?: { src: string; name: string } }
const BENTO: BCell[] = [
  { k: 'head' },
  { k: 'e' }, { k: 'a', c: '#5ce1ff' }, { k: 'e' }, { k: 'logo', logo: SUP.minipay }, { k: 'e' }, { k: 'a', c: '#7c5cff' },
  { k: 'a', c: '#7c5cff' }, { k: 'e' }, { k: 'logo', logo: SUP.celo }, { k: 'e' }, { k: 'e' }, { k: 'logo', logo: SUP.metamask }, { k: 'e' }, { k: 'a', c: '#5ce1ff' },
  { k: 'e' }, { k: 'a', c: '#a855f7' }, { k: 'e' }, { k: 'logo', logo: SUP.privy }, { k: 'feat' }, { k: 'e' }, { k: 'a', c: 'rgba(92,225,255,.45)' },
  { k: 'a', c: '#5ce1ff' }, { k: 'e' }, { k: 'e' }, { k: 'e' }, { k: 'a', c: 'rgba(124,92,255,.45)' }, { k: 'e' }, { k: 'e' }, { k: 'e' },
]

/* ───────────────────────── chess logic ───────────────────────── */

type Piece = { t: string; c: 'w' | 'b' }
type Board = (Piece | null)[][]

function makeBoard(): Board {
  const P = (t: string, c: 'w' | 'b'): Piece => ({ t, c })
  const b: Board = Array.from({ length: 8 }, () => Array(8).fill(null))
  b[0][0] = P('r', 'b'); b[0][4] = P('k', 'b'); b[1][6] = P('b', 'b')
  b[2][1] = P('n', 'b'); b[3][3] = P('p', 'b'); b[4][6] = P('p', 'b')
  b[7][0] = P('r', 'w'); b[7][4] = P('k', 'w'); b[7][2] = P('b', 'w')
  b[5][5] = P('n', 'w'); b[4][3] = P('q', 'w'); b[6][4] = P('p', 'w')
  return b
}

function legalMoves(b: Board, r: number, c: number): [number, number][] {
  const p = b[r][c]
  if (!p) return []
  const me = p.c
  const moves: [number, number][] = []
  const inb = (x: number, y: number) => x >= 0 && x < 8 && y >= 0 && y < 8
  const add = (x: number, y: number) => {
    if (!inb(x, y)) return false
    const t = b[x][y]
    if (!t) { moves.push([x, y]); return true }
    if (t.c !== me) moves.push([x, y])
    return false
  }
  const ray = (dx: number, dy: number) => { let x = r + dx, y = c + dy; while (inb(x, y)) { if (!add(x, y)) break; x += dx; y += dy } }
  if (p.t === 'n') ([[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]] as const).forEach(([dx, dy]) => add(r + dx, c + dy))
  else if (p.t === 'k') { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) add(r + dx, c + dy) }
  else if (p.t === 'r') { ray(1, 0); ray(-1, 0); ray(0, 1); ray(0, -1) }
  else if (p.t === 'b') { ray(1, 1); ray(1, -1); ray(-1, 1); ray(-1, -1) }
  else if (p.t === 'q') { ray(1, 0); ray(-1, 0); ray(0, 1); ray(0, -1); ray(1, 1); ray(1, -1); ray(-1, 1); ray(-1, -1) }
  else if (p.t === 'p') {
    const dir = me === 'w' ? -1 : 1, start = me === 'w' ? 6 : 1
    if (inb(r + dir, c) && !b[r + dir][c]) { moves.push([r + dir, c]); if (r === start && !b[r + 2 * dir][c]) moves.push([r + 2 * dir, c]) }
    ;([[dir, 1], [dir, -1]] as const).forEach(([dx, dy]) => { const x = r + dx, y = c + dy; if (inb(x, y) && b[x][y] && b[x][y]!.c !== me) moves.push([x, y]) })
  }
  return moves
}

/* ───────────────────────── coach art (our own piece set) ───────────────────────── */

function CoachArt({ coach, size }: { coach: Coach; size: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${PIECE_SET}/${coach.piece}.svg`}
      alt={coach.name}
      style={{ position: 'relative', width: size, height: size, objectFit: 'contain', filter: `drop-shadow(0 16px 40px ${hexToRgba(coach.accent, 0.5)})` }}
    />
  )
}

/* ───────────────────────── styles ───────────────────────── */

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Anton&family=Chakra+Petch:ital,wght@0,500;0,600;0,700;1,600;1,700&family=Permanent+Marker&display=swap');
  .ccv *{box-sizing:border-box;}
  .ccv{margin:0;background:#060a18;color:#eaf3fb;font-family:var(--fb),system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden;cursor:url('/pieces/chessnut/wN.svg') 8 4, auto;}
  .ccv button,.ccv a,.ccv [style*="cursor:pointer"]{cursor:url('/pieces/chessnut/wN.svg') 10 4, pointer !important;}
  .ccv ::selection{background:rgba(56,232,255,.32);color:#fff;}
  @keyframes ccv-shine{to{background-position:200% center;}}
  @keyframes ccv-floatB{0%,100%{transform:translateY(0);}50%{transform:translateY(-26px);}}
  @keyframes ccv-gridPan{to{background-position:60px 60px;}}
  @keyframes ccv-rise{from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:translateY(0);}}
  @keyframes ccv-spinRing{to{transform:rotate(360deg);}}
  @keyframes ccv-marquee{from{transform:translateX(0);}to{transform:translateX(-50%);}}
  @keyframes ccv-twinkle{0%,100%{opacity:.15;}50%{opacity:.8;}}
  .ccv-link{transition:color .2s;}
  .ccv-link:hover{color:#5ce1ff !important;}
  .ccv-icon{transition:color .2s,border-color .2s;}
  .ccv-icon:hover{color:#5ce1ff !important;border-color:rgba(56,232,255,.5) !important;}
  .ccv-cta:hover{box-shadow:0 0 40px rgba(56,232,255,.8) !important;}
  .ccv-cta2:hover{background:rgba(124,92,255,.16) !important;}
  .ccv-arrow:hover{border-color:#5ce1ff !important;color:#5ce1ff !important;}
  .ccv-train:hover{transform:translateY(-2px) !important;}
  .ccv-play:hover{transform:skewX(-10deg) translateY(-3px) !important;}
  .ccv-mode{transition:box-shadow .2s,transform .2s;}
  .ccv-wallet:hover{filter:brightness(1.2);}
  .ccv-sep{color:rgba(120,200,255,.28);font-weight:400;user-select:none;pointer-events:none;}
  .ccv-burger{display:none;}
  .ccv-drawer-link{transition:background .15s,color .15s;}
  .ccv-drawer-link:hover{background:rgba(56,232,255,.06);color:#eaf6ff !important;}
  .ccv-carousel{touch-action:pan-y;}
  /* ── 'Plays nice with' bento — uniform inset gridlines so it reads as one grid
     at any column count; clamps from 6→4→2 columns across breakpoints ── */
  .ccv-bento-fb{width:100vw;margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw);}
  .ccv-bcell{border-right:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;position:relative;}
  .ccv-blabel{font-family:'Chakra Petch';font-weight:700;font-size:clamp(10px,1.2vw,15px);color:#cfdae6;letter-spacing:.02em;text-align:center;}
  .ccv-blogo{flex-direction:column;gap:clamp(7px,1.2vw,12px);background:rgba(255,255,255,.022);transition:background .2s;}
  .ccv-blogo:hover{background:rgba(255,255,255,.05) !important;}
  .ccv-blogo img{max-width:clamp(34px,4.4vw,64px);max-height:clamp(26px,3.4vw,46px);object-fit:contain;}
  @media (max-width:960px){ .ccv-bento{grid-template-columns:repeat(6,1fr) !important;grid-auto-rows:16.66vw !important;} }
  @media (max-width:560px){ .ccv-bento{grid-template-columns:repeat(4,1fr) !important;grid-auto-rows:25vw !important;} }

  /* ── MOBILE-FIRST RESPONSIVE (≤768px) ── */
  @media (max-width:768px){
    .ccv-header{padding:12px 18px !important;}
    .ccv-nav-center{display:none !important;}
    .ccv-navcta{display:none !important;}
    .ccv-burger{display:flex !important;}
    .ccv-social-rail{display:none !important;}
    .ccv-hero{padding:100px 18px 56px !important;}
    .ccv-hero-grid{flex-direction:column !important;gap:10px !important;text-align:center !important;}
    .ccv-hero-king{min-height:340px !important;flex:1 1 auto !important;width:100% !important;}
    .ccv-hero-copy{flex:1 1 auto !important;width:100% !important;}
    .ccv-hero-copy p{margin-left:auto !important;margin-right:auto !important;}
    .ccv-hero-cta{justify-content:center !important;}
    .ccv-sec{padding-left:18px !important;padding-right:18px !important;}
    .ccv-grid3{grid-template-columns:1fr !important;}
    .ccv-arrow{width:42px !important;height:42px !important;font-size:20px !important;}
    .ccv-constellation{height:380px !important;}
    /* Full-bleed interactive board: break out of the page gutters so it touches
       both screen edges; cells fill 1/8 of the viewport for a big tap target. */
    .ccv-board-wrap{width:100vw !important;margin-left:calc(50% - 50vw) !important;margin-right:calc(50% - 50vw) !important;}
    .ccv-board{width:100vw !important;grid-template-columns:repeat(8,1fr) !important;grid-auto-rows:calc((100vw - 16px) / 8) !important;border-radius:0 !important;border-left:0 !important;border-right:0 !important;padding:8px !important;}
    .ccv-footer{padding:24px 18px !important;flex-direction:column !important;text-align:center !important;justify-content:center !important;}
  }
`

/* ───────────────────────── component ───────────────────────── */

export default function ChessifyLanding() {
  const router = useRouter()
  const { isConnected, connectWallet } = useWallet()

  const [coach, setCoach] = useState(0)
  const [board, setBoard] = useState<Board>(() => makeBoard())
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null)
  const [connectOpen, setConnectOpen] = useState(false)
  const [sound, setSound] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const ebRef = useRef<HTMLDivElement | null>(null)
  const ebCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const particlesRef = useRef<HTMLDivElement | null>(null)
  const touchX = useRef<number | null>(null)

  /* track mobile breakpoint so the coach carousel can keep its 3-card stage
     (center + two angled sides) at a smaller scale instead of hiding the sides */
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const apply = () => setIsMobile(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  /* cursor glow */
  useEffect(() => {
    const cur = document.getElementById('ccv-cursor')
    const mm = (e: MouseEvent) => {
      if (cur) cur.style.transform = `translate(${e.clientX - 300}px,${e.clientY - 300}px)`
    }
    window.addEventListener('mousemove', mm)
    return () => window.removeEventListener('mousemove', mm)
  }, [])

  /* tilt cards */
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-tilt]'))
    const handlers = els.map((el) => {
      const move = (e: MouseEvent) => {
        const r = el.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width - 0.5
        const py = (e.clientY - r.top) / r.height - 0.5
        el.style.transform = `perspective(900px) rotateY(${px * 9}deg) rotateX(${-py * 9}deg) translateY(-6px)`
      }
      const leave = () => { el.style.transform = 'perspective(900px) rotateY(0deg) rotateX(0deg) translateY(0)' }
      el.addEventListener('mousemove', move)
      el.addEventListener('mouseleave', leave)
      return { el, move, leave }
    })
    return () => handlers.forEach((h) => { h.el.removeEventListener('mousemove', h.move); h.el.removeEventListener('mouseleave', h.leave) })
  }, [])

  /* electric border canvas around the hero king */
  useEffect(() => {
    const container = ebRef.current
    const canvas = ebCanvasRef.current
    if (!container || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const color = '#5ce1ff'
    const speed = 1, octaves = 10, lacunarity = 1.6, gain = 0.7, amplitude = 0.12,
      frequency = 10, baseFlatness = 0, displacement = 30, borderOffset = 60, borderRadius = 28
    let ebTime = 0
    const random = (x: number) => (Math.sin(x * 12.9898) * 43758.5453) % 1
    const noise2D = (x: number, y: number) => {
      const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j
      const a = random(i + j * 57), b = random(i + 1 + j * 57), c = random(i + (j + 1) * 57), d = random(i + 1 + (j + 1) * 57)
      const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
      return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy
    }
    const oct = (x: number, seed: number) => {
      let y = 0, amp = amplitude, freq = frequency
      for (let i = 0; i < octaves; i++) {
        let oa = amp; if (i === 0) oa *= baseFlatness
        y += oa * noise2D(freq * x + seed * 100, ebTime * freq * 0.3)
        freq *= lacunarity; amp *= gain
      }
      return y
    }
    const corner = (cx: number, cy: number, r: number, sa: number, al: number, p: number) => { const a = sa + p * al; return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) } }
    const rr = (t: number, left: number, top: number, w: number, h: number, r: number) => {
      const sw = w - 2 * r, sh = h - 2 * r, ca = (Math.PI * r) / 2, tot = 2 * sw + 2 * sh + 4 * ca, d = t * tot; let acc = 0
      if (d <= acc + sw) return { x: left + r + (d - acc), y: top }; acc += sw
      if (d <= acc + ca) return corner(left + w - r, top + r, r, -Math.PI / 2, Math.PI / 2, (d - acc) / ca); acc += ca
      if (d <= acc + sh) return { x: left + w, y: top + r + (d - acc) }; acc += sh
      if (d <= acc + ca) return corner(left + w - r, top + h - r, r, 0, Math.PI / 2, (d - acc) / ca); acc += ca
      if (d <= acc + sw) return { x: left + w - r - (d - acc), y: top + h }; acc += sw
      if (d <= acc + ca) return corner(left + r, top + h - r, r, Math.PI / 2, Math.PI / 2, (d - acc) / ca); acc += ca
      if (d <= acc + sh) return { x: left, y: top + h - r - (d - acc) }; acc += sh
      return corner(left + r, top + r, r, Math.PI, Math.PI / 2, (d - acc) / ca)
    }
    let width = 0, height = 0
    const updateSize = () => {
      const rect = container.getBoundingClientRect()
      width = rect.width + borderOffset * 2; height = rect.height + borderOffset * 2
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = width * dpr; canvas.height = height * dpr
      canvas.style.width = width + 'px'; canvas.style.height = height + 'px'
    }
    updateSize()
    let last = performance.now()
    let raf = 0
    const draw = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      ebTime += ((now - last) / 1000) * speed; last = now
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.scale(dpr, dpr)
      const left = borderOffset, top = borderOffset, bw = width - 2 * borderOffset, bh = height - 2 * borderOffset
      const r = Math.min(borderRadius, Math.min(bw, bh) / 2)
      const samples = Math.floor((2 * (bw + bh) + 2 * Math.PI * r) / 2)
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color; ctx.shadowColor = color
      const passes = [{ w: 3.4, blur: 20, a: 0.85 }, { w: 1.3, blur: 6, a: 1 }]
      for (const ps of passes) {
        ctx.beginPath()
        for (let i = 0; i <= samples; i++) {
          const pr = i / samples, pt = rr(pr, left, top, bw, bh, r)
          const dx = pt.x + oct(pr * 8, 0) * displacement, dy = pt.y + oct(pr * 8, 1) * displacement
          if (i === 0) ctx.moveTo(dx, dy); else ctx.lineTo(dx, dy)
        }
        ctx.closePath(); ctx.globalAlpha = ps.a; ctx.lineWidth = ps.w; ctx.shadowBlur = ps.blur; ctx.stroke()
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    const ro = new ResizeObserver(() => updateSize())
    ro.observe(container)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  /* redirect once connected */
  useEffect(() => { if (isConnected) router.replace('/app/lobby') }, [isConnected, router])

  /* handlers */
  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (el) window.scrollTo({ top: el.offsetTop - 72, behavior: 'smooth' })
  }, [])

  const start = useCallback(() => {
    if (isConnected) { router.push('/app/lobby'); return }
    setConnectOpen(true)
  }, [isConnected, router])

  const closeConnect = useCallback(() => setConnectOpen(false), [])

  const toggleSound = useCallback(() => {
    setSound((on) => {
      const next = !on
      if (next) { startAmbient(); setMuted(false) } else { setMuted(true) }
      return next
    })
  }, [])

  // stop ambient track when leaving the landing
  useEffect(() => () => stopAmbient(), [])

  // close the mobile drawer when the viewport grows back to desktop
  useEffect(() => {
    const close = () => setMenuOpen(false)
    window.addEventListener('resize', close)
    return () => window.removeEventListener('resize', close)
  }, [])

  const goDrawer = useCallback((fn: () => void) => { setMenuOpen(false); fn() }, [])

  const charge = useCallback(() => {
    const k = document.getElementById('ccv-king')
    if (k && k.animate) k.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.09)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' })
    const cont = particlesRef.current
    if (cont) {
      const p = document.createElement('div')
      p.textContent = '+1'
      p.style.cssText = `position:absolute;left:${38 + Math.random() * 24}%;top:${38 + Math.random() * 12}%;color:#5ce1ff;font-family:'Chakra Petch',sans-serif;font-weight:700;font-size:${18 + Math.random() * 12}px;pointer-events:none;text-shadow:0 0 14px rgba(56,232,255,.9);z-index:9;`
      cont.appendChild(p)
      const a = p.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-100px)', opacity: 0 }], { duration: 950, easing: 'ease-out' })
      a.onfinish = () => p.remove()
    }
  }, [])

  const onSquare = useCallback((r: number, c: number) => {
    setBoard((b) => {
      if (sel) {
        const ok = legalMoves(b, sel.r, sel.c).some(([x, y]) => x === r && y === c)
        if (ok) {
          const nb = b.map((row) => row.slice())
          nb[r][c] = nb[sel.r][sel.c]; nb[sel.r][sel.c] = null
          setSel(null)
          return nb
        }
      }
      setSel(b[r][c] ? { r, c } : null)
      return b
    })
  }, [sel])

  /* swipe — drag the coach deck left/right on touch devices */
  const onTouchStart = useCallback((e: React.TouchEvent) => { touchX.current = e.touches[0].clientX }, [])
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    if (Math.abs(dx) > 40) setCoach((c) => c + (dx < 0 ? 1 : -1))
    touchX.current = null
  }, [])

  /* derived view models */
  const n = COACHES.length
  const idx = ((coach % n) + n) % n
  // Image-carousel geometry: a horizontal track of every coach card slides so the
  // active card centers; bigger cards on mobile than the old peek layout.
  const cardW = isMobile ? 250 : 300
  const cardH = isMobile ? 366 : 430
  const cardGap = isMobile ? 18 : 28
  const slot = cardW + cardGap
  const f = COACHES[idx]

  /* boards */
  const legalSet = new Set((sel ? legalMoves(board, sel.r, sel.c) : []).map(([x, y]) => `${x}-${y}`))

  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']

  const nodePos: [number, number][] = [[12, 60], [27, 27], [41, 67], [53, 31], [67, 64], [81, 29], [91, 60]]
  const cpts: [number, number][] = [[120, 216], [270, 97], [410, 241], [530, 112], [670, 230], [810, 104], [910, 216]]

  return (
    <main className="ccv">
      <style>{STYLE}</style>

      <div style={{ position: 'relative', minHeight: '100vh', background: '#04060f', overflow: 'hidden' }}>

        {/* BACKGROUND LAYERS */}
        <div style={css('position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(1100px 780px at 50% -10%,rgba(34,211,238,.24),transparent 56%),radial-gradient(820px 620px at 84% 18%,rgba(124,92,255,.20),transparent 60%),radial-gradient(760px 600px at 8% 82%,rgba(34,211,238,.14),transparent 60%),radial-gradient(680px 520px at 78% 80%,rgba(168,85,247,.12),transparent 62%),#060a18;')} />
        <div style={css('position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.4;background-image:linear-gradient(rgba(120,200,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(120,200,255,.05) 1px,transparent 1px);background-size:60px 60px;-webkit-mask-image:radial-gradient(circle at 50% 16%,#000,transparent 80%);mask-image:radial-gradient(circle at 50% 16%,#000,transparent 80%);animation:ccv-gridPan 24s linear infinite;')} />
        <div style={css('position:fixed;top:14%;left:18%;width:4px;height:4px;border-radius:50%;background:#5ce1ff;box-shadow:0 0 8px #5ce1ff;animation:ccv-twinkle 3s infinite;z-index:0;')} />
        <div style={css('position:fixed;top:30%;left:70%;width:3px;height:3px;border-radius:50%;background:#9fe9ff;box-shadow:0 0 6px #9fe9ff;animation:ccv-twinkle 4s .6s infinite;z-index:0;')} />
        <div style={css('position:fixed;top:62%;left:40%;width:3px;height:3px;border-radius:50%;background:#5ce1ff;box-shadow:0 0 6px #5ce1ff;animation:ccv-twinkle 3.4s 1.1s infinite;z-index:0;')} />
        <div style={css('position:fixed;top:48%;left:84%;width:4px;height:4px;border-radius:50%;background:#7c9cff;box-shadow:0 0 8px #7c9cff;animation:ccv-twinkle 5s .3s infinite;z-index:0;')} />

        {/* CURSOR GLOW */}
        <div id="ccv-cursor" style={css('position:fixed;top:0;left:0;width:600px;height:600px;border-radius:50%;pointer-events:none;z-index:1;background:radial-gradient(circle,rgba(34,211,238,.10),transparent 60%);transform:translate(-9999px,-9999px);will-change:transform;')} />

        <div style={{ position: 'relative', zIndex: 3 }}>

          {/* NAV */}
          <header className="ccv-header" style={css('position:fixed;top:0;left:0;right:0;z-index:80;display:flex;align-items:center;justify-content:space-between;padding:16px 40px;backdrop-filter:blur(14px);background:linear-gradient(180deg,rgba(4,6,15,.92),rgba(4,6,15,.3) 70%,rgba(4,6,15,0));border-bottom:1px solid rgba(120,200,255,.07);')}>
            <div onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={css('display:flex;align-items:center;cursor:pointer;')}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/chessify.png" alt="Chessify" style={css('height:clamp(28px,5vw,36px);width:auto;object-fit:contain;filter:drop-shadow(0 0 14px rgba(56,232,255,.4));')} />
            </div>
            {/* Center trapezoid — same shape as the main landing nav: full width at the
                top edge, tapering at the bottom, links split by hairline separators. */}
            <nav className="ccv-nav-center" style={{ position: 'relative' }}>
              <div style={css('position:relative;clip-path:polygon(0 0,100% 0,calc(100% - 22px) 100%,22px 100%);background:linear-gradient(120deg,rgba(92,225,255,.55),rgba(124,92,255,.45));padding:1.5px;filter:drop-shadow(0 6px 18px rgba(0,0,0,.45));')}>
                <div style={css("display:flex;align-items:center;gap:18px;padding:12px 44px;clip-path:polygon(0 0,100% 0,calc(100% - 22px) 100%,22px 100%);background:linear-gradient(180deg,rgba(14,24,46,.97),rgba(9,15,30,.97));font-family:'Chakra Petch';font-size:13px;font-weight:600;letter-spacing:.08em;color:#9fb2c8;text-transform:uppercase;")}>
                  <span className="ccv-link" onClick={() => router.push('/app/leaderboard')} style={{ cursor: 'pointer' }}>Leaderboard</span>
                  <span className="ccv-sep">|</span>
                  <span className="ccv-link" onClick={() => router.push('/app/history')} style={{ cursor: 'pointer' }}>History</span>
                  <span className="ccv-sep">|</span>
                  <span className="ccv-link" onClick={() => router.push('/app/faucet')} style={{ cursor: 'pointer' }}>Faucet</span>
                  <span className="ccv-sep">|</span>
                  <span className="ccv-link" onClick={() => scrollTo('coaches')} style={css('cursor:pointer;display:flex;align-items:center;gap:7px;')}>Coaches<span style={css("font-family:var(--fb);font-size:9px;font-weight:700;padding:2px 6px;border-radius:5px;background:rgba(56,232,255,.18);color:#5ce1ff;letter-spacing:.06em;")}>NEW</span></span>
                </div>
              </div>
            </nav>
            <div style={css('display:flex;align-items:center;gap:12px;')}>
              <button onClick={toggleSound} style={css("width:40px;height:40px;border-radius:10px;border:1px solid rgba(120,200,255,.16);background:rgba(120,200,255,.05);color:#9fb2c8;cursor:pointer;font-size:13px;font-family:inherit;flex-shrink:0;")}>{sound ? '♪ on' : '♪ off'}</button>
              <GlowButton variant="brand" parallelogram className="ccv-navcta" onClick={start} style={{ padding: '12px 30px', fontSize: 13 }}>CONNECT ▸</GlowButton>
              {/* Mobile hamburger */}
              <button className="ccv-burger" onClick={() => setMenuOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={menuOpen} style={css('width:42px;height:42px;flex-direction:column;align-items:center;justify-content:center;gap:5px;border-radius:11px;border:1px solid rgba(120,200,255,.18);background:rgba(10,18,32,.7);cursor:pointer;flex-shrink:0;')}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{
                    display: 'block', width: 18, height: 2, borderRadius: 2,
                    background: menuOpen ? '#5ce1ff' : '#cdd9e8',
                    transition: 'transform .2s ease, opacity .15s',
                    transform: menuOpen
                      ? i === 0 ? 'translateY(7px) rotate(45deg)'
                      : i === 2 ? 'translateY(-7px) rotate(-45deg)'
                      : 'scaleX(0)'
                      : 'none',
                    opacity: menuOpen && i === 1 ? 0 : 1,
                  }} />
                ))}
              </button>
            </div>
          </header>

          {/* MOBILE DRAWER */}
          {menuOpen && (
            <div className="ccv-burger" style={css('position:fixed;top:66px;left:0;right:0;z-index:79;flex-direction:column;gap:4px;padding:14px 18px 20px;background:rgba(6,10,24,.98);backdrop-filter:blur(18px);border-bottom:1px solid rgba(120,200,255,.1);box-shadow:0 24px 50px rgba(0,0,0,.55);')}>
              {[
                { label: 'Leaderboard', fn: () => router.push('/app/leaderboard') },
                { label: 'History', fn: () => router.push('/app/history') },
                { label: 'Faucet', fn: () => router.push('/app/faucet') },
                { label: 'Coaches', fn: () => scrollTo('coaches') },
                { label: 'Arena', fn: () => scrollTo('modes') },
                { label: 'How it works', fn: () => scrollTo('how') },
              ].map((it) => (
                <span key={it.label} className="ccv-drawer-link" onClick={() => goDrawer(it.fn)} style={css("display:flex;align-items:center;gap:10px;padding:13px 14px;border-radius:12px;cursor:pointer;font-family:'Chakra Petch';font-weight:600;font-size:13px;letter-spacing:.07em;text-transform:uppercase;color:#9fb2c8;")}>
                  <span style={{ color: '#5ce1ff', fontSize: 8, opacity: 0.7 }}>◈</span>{it.label}
                </span>
              ))}
              <GlowButton variant="brand" parallelogram fullWidth onClick={() => goDrawer(start)} style={{ marginTop: 8 }}>CONNECT ▸</GlowButton>
            </div>
          )}

          {/* HERO */}
          <section id="hero" className="ccv-hero" style={css('position:relative;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:120px 24px 70px;overflow:hidden;')}>

            <div className="ccv-social-rail" style={css('position:absolute;left:30px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:12px;z-index:20;')}>
              {['𝕏', '✦', '✈', '◎'].map((g, i) => (
                <div key={i} className="ccv-icon" style={css('width:42px;height:42px;border-radius:11px;border:1px solid rgba(120,200,255,.18);background:rgba(10,18,32,.7);display:flex;align-items:center;justify-content:center;color:#9fb2c8;cursor:pointer;font-size:16px;')}>{g}</div>
              ))}
            </div>

            {/* NEON CHESS BOARD BACKGROUND */}
            <div style={css('position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;display:flex;align-items:center;justify-content:center;')}>
              <div style={css('position:absolute;top:50%;left:50%;width:1300px;height:1300px;opacity:.9;transform:translate(-50%,-46%) perspective(1500px) rotateX(54deg) rotateZ(-3deg);transform-origin:center;-webkit-mask-image:radial-gradient(ellipse 72% 70% at 50% 44%,#000 44%,transparent 84%);mask-image:radial-gradient(ellipse 72% 70% at 50% 44%,#000 44%,transparent 84%);')}>
                <div style={css('display:grid;grid-template-columns:repeat(8,1fr);grid-auto-rows:1fr;width:100%;height:100%;border:1px solid rgba(56,232,255,.4);box-shadow:0 0 150px rgba(56,232,255,.4),inset 0 0 110px rgba(124,92,255,.28);')}>
                  {Array.from({ length: 64 }).map((_, k) => {
                    const r = Math.floor(k / 8), c = k % 8
                    const dark = (r + c) % 2 === 1
                    let t: string | null = null, col: 'w' | 'b' | null = null
                    if (r === 0) { t = back[c]; col = 'b' } else if (r === 1) { t = 'p'; col = 'b' } else if (r === 6) { t = 'p'; col = 'w' } else if (r === 7) { t = back[c]; col = 'w' }
                    return (
                      <div key={k} style={css(`position:relative;display:flex;align-items:center;justify-content:center;background:${dark ? 'rgba(10,32,54,.92)' : 'rgba(20,52,78,.78)'};box-shadow:inset 0 0 0 1px rgba(56,232,255,.10);`)}>
                        {t && <span style={css(`font-size:46px;line-height:1;${col === 'w' ? 'color:#dffcff;text-shadow:0 0 16px rgba(56,232,255,.9),0 0 34px rgba(56,232,255,.5);' : 'color:#1c2740;-webkit-text-stroke:1.5px rgba(168,90,247,.9);text-shadow:0 0 18px rgba(168,90,247,.75);'}`)}>{GLYPH[t]}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={css('position:absolute;inset:0;background:radial-gradient(ellipse 80% 70% at 68% 48%,rgba(4,8,18,.5),rgba(4,8,18,.22) 58%,transparent 84%);')} />
              <div style={css('position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,8,18,.4),transparent 26%,transparent 74%,rgba(4,8,18,.72));')} />
            </div>

            {/* FOREGROUND */}
            <div className="ccv-hero-grid" style={css('position:relative;z-index:5;width:100%;max-width:1280px;margin:0 auto;display:flex;align-items:center;gap:20px;animation:ccv-rise .8s ease both;')}>

              {/* LEFT: king */}
              <div className="ccv-hero-king" style={css('flex:1 1 44%;position:relative;align-self:stretch;min-height:560px;display:flex;align-items:center;justify-content:center;')}>
                <div style={css('position:absolute;left:2%;top:6%;width:120%;height:80%;z-index:1;pointer-events:none;transform:rotate(18deg);transform-origin:left center;')}>
                  <div style={css('position:absolute;left:0;top:34%;width:100%;height:14px;border-radius:99px;background:linear-gradient(90deg,rgba(56,232,255,.85),transparent);filter:blur(2px);')} />
                  <div style={css('position:absolute;left:4%;top:48%;width:88%;height:8px;border-radius:99px;background:linear-gradient(90deg,rgba(168,90,247,.75),transparent);filter:blur(1px);')} />
                  <div style={css('position:absolute;left:8%;top:60%;width:74%;height:5px;border-radius:99px;background:linear-gradient(90deg,rgba(146,234,255,.9),transparent);')} />
                </div>

                <div ref={ebRef} style={css('position:relative;z-index:3;width:clamp(270px,29vw,420px);aspect-ratio:3 / 4.1;border-radius:28px;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse 75% 60% at 50% 42%,rgba(56,232,255,.13),rgba(8,14,28,.5) 70%);box-shadow:inset 0 0 60px rgba(56,232,255,.14);')}>
                  <canvas ref={ebCanvasRef} style={css('position:absolute;left:-60px;top:-60px;pointer-events:none;z-index:5;')} />
                  {/* Float wrapper fills the box so the canvas (and the king centered
                      at x=0 within it) sits dead-center horizontally and vertically */}
                  <div style={css('position:absolute;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;animation:ccv-floatB 6s ease-in-out infinite;will-change:transform;')}>
                    <div style={css('position:absolute;left:50%;bottom:8%;width:78%;height:42px;transform:translateX(-50%);background:radial-gradient(ellipse,rgba(56,232,255,.5),transparent 70%);filter:blur(15px);z-index:-1;')} />
                    <div ref={particlesRef} style={css('position:absolute;inset:0;pointer-events:none;z-index:6;')} />
                    {/* our own 3D king model — physical (reflective) material so the
                        surface texture reads, with a subtle emissive rim to glow */}
                    <div id="ccv-king" onClick={charge} style={{ width: '100%', height: '100%', cursor: 'pointer', filter: 'drop-shadow(0 26px 60px rgba(56,232,255,.55))' }}>
                      <Canvas camera={{ position: [0, 0, 6.4], fov: 45 }} gl={{ alpha: true }}>
                        <Suspense fallback={null}>
                          <ambientLight intensity={1.2} />
                          <pointLight position={[6, 6, 6]} intensity={2.8} color="#bdf2ff" />
                          <pointLight position={[-6, -4, -4]} intensity={1.4} color="#7c5cff" />
                          <Environment files="/textures/environment/city.hdr" />
                          <King color="#9fdfff" emissive="#5ce1ff" emissiveIntensity={0.18} roughness={0.28} metalness={0.72} scale={2.85} position={[0, -1.05, 0]} rotationIntensity={0.12} floatSpeed={1.4} floatIntensity={1.1} />
                        </Suspense>
                      </Canvas>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: headline */}
              <div className="ccv-hero-copy" style={css('flex:1 1 56%;min-width:0;position:relative;')}>
                <div style={css("font-family:'Permanent Marker';font-size:clamp(18px,2.4vw,30px);color:#38e8ff;text-shadow:0 0 22px rgba(56,232,255,.7);transform:rotate(-4deg);margin-bottom:14px;")}>your move, champion</div>
                <div style={css('transform:skewX(-6deg);line-height:.96;')}>
                  <div style={css("font-family:'Anton';font-size:clamp(48px,8vw,92px);color:transparent;-webkit-text-stroke:2px rgba(146,234,255,.78);text-shadow:0 0 30px rgba(56,232,255,.2);")}>LEARN.</div>
                  <div style={css("font-family:'Anton';font-size:clamp(48px,8vw,92px);color:#eaf6ff;text-shadow:0 0 30px rgba(56,232,255,.3),0 6px 18px rgba(0,0,0,.7);")}>PLAY.</div>
                  <div style={css("font-family:'Anton';font-size:clamp(48px,8vw,92px);background:linear-gradient(100deg,#5ce1ff,#a8f0ff 50%,#a855f7);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:ccv-shine 6s linear infinite;filter:drop-shadow(0 4px 16px rgba(0,0,0,.5));")}>STAKE.</div>
                  <div style={css("font-family:'Anton';font-size:clamp(62px,12.5vw,140px);color:#fff;text-shadow:0 0 44px rgba(56,232,255,.55),0 0 90px rgba(124,92,255,.4),0 8px 26px rgba(0,0,0,.7);")}>CHECKMATE.</div>
                </div>
                <p style={css('margin:26px 0 0;max-width:420px;font-size:17px;line-height:1.6;color:#bccadb;text-shadow:0 2px 12px rgba(4,6,15,.9);')}>Train with a coach, wager your skill on-chain, and keep every coin you win.</p>
                <div className="ccv-hero-cta" style={css('display:flex;gap:14px;margin-top:28px;flex-wrap:wrap;align-items:stretch;')}>
                  <GlowButton variant="brand" parallelogram onClick={start} style={{ fontSize: 15 }}>PLAY NOW ▸</GlowButton>
                  <button className="ccv-cta2" onClick={() => scrollTo('how')} style={css("padding:16px 34px;cursor:pointer;font-family:var(--fd);font-weight:800;letter-spacing:.08em;font-size:14px;color:#5ce1ff;background:rgba(124,92,255,.08);border:1px solid rgba(124,92,255,.45);clip-path:polygon(16px 0%,100% 0%,calc(100% - 16px) 100%,0% 100%);")}>HOW IT WORKS</button>
                </div>
              </div>
            </div>

            <div onClick={() => scrollTo('coaches')} style={css("position:absolute;bottom:24px;left:50%;transform:translateX(-50%);font-family:'Chakra Petch';font-size:10px;letter-spacing:.32em;color:#5b7290;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;z-index:15;")}>SCROLL<span style={css('width:1px;height:30px;background:linear-gradient(#5ce1ff,transparent);')} /></div>
          </section>

          {/* MARQUEE */}
          <div style={css('position:relative;z-index:5;border-top:1px solid rgba(56,232,255,.16);border-bottom:1px solid rgba(56,232,255,.16);background:rgba(56,232,255,.05);overflow:hidden;padding:14px 0;')}>
            <div style={css("display:flex;width:max-content;animation:ccv-marquee 26s linear infinite;font-family:'Chakra Petch';font-weight:700;font-style:italic;font-size:16px;letter-spacing:.08em;color:#5ce1ff;text-transform:uppercase;")}>
              <span style={css('padding:0 28px;')}>Provably fair ✦ 0% platform fees ✦ Play on-chain ✦ 1,000 free CHESS daily ✦ Winner takes the pot ✦ Train with a coach ✦ Provably fair ✦ 0% platform fees ✦ Play on-chain ✦ 1,000 free CHESS daily ✦ Winner takes the pot ✦ Train with a coach ✦</span>
            </div>
          </div>

          {/* TRY A MOVE */}
          <section className="ccv-sec" style={css('position:relative;z-index:5;max-width:1180px;margin:0 auto;padding:90px 40px 40px;display:flex;align-items:center;gap:60px;flex-wrap:wrap;')}>
            <div style={css('flex:1;min-width:320px;')}>
              <span style={css("font-family:'Permanent Marker';font-size:26px;color:#38e8ff;text-shadow:0 0 20px rgba(56,232,255,.6);")}>try it</span>
              <h2 style={css("font-family:'Anton';font-size:clamp(40px,5.5vw,72px);line-height:.92;letter-spacing:.005em;margin:6px 0 0;color:#eaf6ff;transform:skewX(-5deg);")}>MAKE A<br /><span style={{ color: '#5ce1ff' }}>MOVE.</span></h2>
              <p style={css('margin:22px 0 0;max-width:430px;font-size:17px;line-height:1.6;color:#a7b8cd;')}>Click any piece to see exactly how it moves — knights leap, bishops and rooks slide until blocked, pawns push and capture on the diagonal. Then take a square. Capture an enemy. Get the feel before you ever stake.</p>
            </div>
            <div className="ccv-board-wrap" style={{ flex: 'none' }}>
              <div className="ccv-board" style={css('display:grid;grid-template-columns:repeat(8,clamp(40px,6vw,64px));grid-auto-rows:clamp(40px,6vw,64px);gap:0;padding:14px;border-radius:16px;background:rgba(8,16,30,.85);border:1px solid rgba(56,232,255,.22);box-shadow:0 24px 60px rgba(0,0,0,.5);')}>
                {Array.from({ length: 64 }).map((_, k) => {
                  const r = Math.floor(k / 8), c = k % 8
                  const dark = (r + c) % 2 === 1, p = board[r][c]
                  const isSel = sel && sel.r === r && sel.c === c
                  const isLegal = legalSet.has(`${r}-${c}`)
                  let bg = dark ? '#0c2138' : '#16334e'
                  if (isSel) bg = 'rgba(56,232,255,.28)'
                  return (
                    <div key={k} onClick={() => onSquare(r, c)} style={css(`position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;background:${bg};${isSel ? 'box-shadow:inset 0 0 0 2px #5ce1ff;' : ''}`)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p && <img src={`${PIECE_SET}/${p.c}${p.t.toUpperCase()}.svg`} alt="" style={css('width:80%;height:80%;object-fit:contain;pointer-events:none;z-index:2;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5));')} />}
                      {isLegal && p && <span style={css('position:absolute;inset:5px;border:3px solid rgba(56,232,255,.85);border-radius:50%;box-shadow:0 0 12px rgba(56,232,255,.6);pointer-events:none;')} />}
                      {isLegal && !p && <span style={css('width:30%;height:30%;border-radius:50%;background:rgba(56,232,255,.6);box-shadow:0 0 10px rgba(56,232,255,.85);pointer-events:none;')} />}
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* COACHES */}
          <section id="coaches" className="ccv-sec" style={css('position:relative;z-index:5;margin-top:50px;padding:80px 40px 90px;background:linear-gradient(180deg,rgba(56,232,255,.04),transparent 36%);border-top:1px solid rgba(120,200,255,.06);')}>
            <div style={css('max-width:1240px;margin:0 auto;')}>
              <div style={css('text-align:center;margin-bottom:50px;')}>
                <span style={css("font-family:'Permanent Marker';font-size:28px;color:#38e8ff;text-shadow:0 0 20px rgba(56,232,255,.6);")}>level up</span>
                <h2 style={css("font-family:'Anton';font-size:clamp(42px,6.5vw,90px);line-height:.9;letter-spacing:.005em;margin:6px 0 0;color:#eaf6ff;transform:skewX(-6deg);")}>PICK YOUR <span style={{ color: '#5ce1ff' }}>COACH</span></h2>
                <p style={css('margin:18px auto 0;max-width:520px;color:#a7b8cd;font-size:17px;line-height:1.6;')}>Every coach is a grandmaster with their own style and personality. Choose your coach — they train you, game after game.</p>
              </div>

              {/* carousel */}
              <div className="ccv-carousel" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={css('position:relative;display:flex;align-items:center;justify-content:center;gap:16px;')}>
                <button className="ccv-arrow" onClick={() => setCoach(idx - 1)} style={css('flex:none;z-index:6;width:56px;height:56px;border-radius:50%;border:1px solid rgba(120,200,255,.25);background:rgba(10,18,32,.8);color:#cdd9e8;cursor:pointer;font-size:24px;backdrop-filter:blur(6px);')}>‹</button>

                <div className="ccv-stage" style={css(`position:relative;flex:1;overflow:hidden;height:${cardH + 60}px;`)}>
                  <div style={css('position:absolute;left:50%;bottom:30px;width:760px;max-width:90%;height:200px;transform:translateX(-50%) rotateX(72deg);transform-origin:center top;border-radius:50%;background:radial-gradient(ellipse at 50% 0%,rgba(56,232,255,.22),rgba(124,92,255,.1) 45%,transparent 72%);filter:blur(2px);z-index:0;')} />
                  {/* sliding track of every coach card */}
                  <div style={{ position: 'absolute', top: '50%', left: '50%', height: cardH, display: 'flex', gap: `${cardGap}px`, transform: `translate(-${idx * slot + cardW / 2}px, -50%)`, transition: 'transform .55s cubic-bezier(.22,.7,.18,1)', zIndex: 2 }}>
                    {COACHES.map((c, i) => {
                      const active = i === idx
                      const frameClr = active ? c.accent : hexToRgba(c.accent, 0.4)
                      const shadow = active ? `0 0 0 1px ${c.accent},0 34px 90px ${hexToRgba(c.accent, 0.45)}` : '0 24px 60px rgba(0,0,0,.55)'
                      return (
                        <div key={c.id} onClick={() => setCoach(i)} style={{ width: cardW, height: cardH, flex: 'none', cursor: active ? 'default' : 'pointer', transform: active ? 'scale(1)' : 'scale(.82)', transformOrigin: 'center center', filter: active ? 'none' : 'brightness(.55) saturate(.85)', transition: 'transform .55s cubic-bezier(.22,.7,.18,1),filter .55s' }}>
                          <div style={css(`position:relative;width:100%;height:100%;border-radius:20px;overflow:hidden;border:2px solid ${frameClr};background:linear-gradient(168deg,${hexToRgba(c.accent, 0.22)},rgba(7,11,22,.92) 62%);box-shadow:${shadow};`)}>
                            <div style={css(`position:absolute;top:14px;left:14px;z-index:4;padding:5px 12px;border-radius:999px;background:rgba(4,6,15,.72);font-family:'Chakra Petch';font-weight:700;font-size:10px;letter-spacing:.12em;color:${c.accent};`)}>{c.rarity}</div>
                            <div style={css("position:absolute;top:14px;right:42px;z-index:4;padding:5px 11px;border-radius:999px;background:rgba(4,6,15,.72);font-family:'Chakra Petch';font-weight:700;font-size:11px;color:#eaf6ff;")}>ELO {c.elo.toLocaleString()}</div>
                            <div style={css('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;')}>
                              <div style={css(`position:absolute;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,${hexToRgba(c.accent, 0.42)},transparent 70%);`)} />
                              <div style={css(`position:absolute;width:212px;height:212px;border:2px dashed ${c.accent};border-radius:50%;opacity:.4;animation:ccv-spinRing 20s linear infinite;`)} />
                              <CoachArt coach={c} size={216} />
                            </div>
                            <div style={css(`position:absolute;top:0;right:0;width:30px;height:100%;background:linear-gradient(180deg,${c.accent},${hexToRgba(c.accent, 0.55)});display:flex;align-items:center;justify-content:center;`)}>
                              <span style={css("writing-mode:vertical-rl;transform:rotate(180deg);font-family:'Chakra Petch';font-weight:700;font-size:11px;letter-spacing:.22em;color:#04121a;text-transform:uppercase;")}>{c.title}</span>
                            </div>
                            <div style={css('position:absolute;left:0;right:30px;bottom:0;padding:20px;background:linear-gradient(180deg,transparent,rgba(4,7,16,.92) 46%);')}>
                              <div style={css("font-family:'Anton';font-size:32px;line-height:1;color:#fff;")}>{c.name}</div>
                              <div style={css(`font-family:'Chakra Petch';font-weight:600;font-size:13px;color:${c.accent};margin-top:3px;letter-spacing:.04em;`)}>{c.title}</div>
                              <div style={css('font-size:11px;color:#9fb2c8;letter-spacing:.04em;margin-top:7px;')}>{c.tags}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <button className="ccv-arrow" onClick={() => setCoach(idx + 1)} style={css('flex:none;z-index:6;width:56px;height:56px;border-radius:50%;border:1px solid rgba(120,200,255,.25);background:rgba(10,18,32,.8);color:#cdd9e8;cursor:pointer;font-size:24px;backdrop-filter:blur(6px);')}>›</button>
              </div>

              {/* selected coach traits + about */}
              <div style={css(`margin:34px auto 0;max-width:840px;display:flex;gap:30px;align-items:stretch;flex-wrap:wrap;border-radius:22px;padding:30px;background:linear-gradient(150deg,${hexToRgba(f.accent, 0.12)},rgba(9,15,30,.6));border:1px solid ${hexToRgba(f.accent, 0.32)};box-shadow:0 24px 60px rgba(0,0,0,.4);`)}>
                <div style={css('flex:1;min-width:280px;')}>
                  <div style={css(`font-family:'Chakra Petch';font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:${f.accent};`)}>Your coach</div>
                  <h3 style={css("font-family:'Anton';font-size:38px;line-height:1;color:#fff;margin:8px 0 0;")}>{f.name} <span style={{ color: f.accent, fontSize: 22 }}>· {f.title}</span></h3>
                  <p style={css('color:#b7c5d8;font-size:16px;line-height:1.65;margin:14px 0 0;max-width:520px;')}>{f.about}</p>
                </div>
                <div style={css('flex:none;width:236px;display:flex;flex-direction:column;gap:14px;')}>
                  <div style={css('display:flex;gap:10px;')}>
                    <div style={css('flex:1;text-align:center;padding:12px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);')}><div style={css("font-family:'Anton';font-size:26px;color:#fff;line-height:1;")}>{f.elo.toLocaleString()}</div><div style={css('font-size:9px;letter-spacing:.14em;color:#7f94ad;margin-top:4px;')}>ELO</div></div>
                    <div style={css(`flex:1;text-align:center;padding:12px;border-radius:12px;background:${hexToRgba(f.accent, 0.12)};border:1px solid ${hexToRgba(f.accent, 0.32)};`)}><div style={css(`font-family:'Chakra Petch';font-weight:700;font-size:12px;color:${f.accent};line-height:1.1;margin-top:4px;`)}>{f.rarity}</div><div style={css('font-size:9px;letter-spacing:.14em;color:#7f94ad;margin-top:6px;')}>RARITY</div></div>
                  </div>
                  <div style={css('display:flex;flex-wrap:wrap;gap:7px;')}>
                    {f.tags.split(' · ').map((tag, ti) => (
                      <span key={ti} style={css('padding:7px 12px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);font-size:12px;color:#cdd9e8;')}>{tag}</span>
                    ))}
                  </div>
                  <button className="ccv-train" onClick={start} style={css(`margin-top:auto;border:none;text-align:center;padding:16px 24px;cursor:pointer;font-family:var(--fd);font-weight:800;letter-spacing:.06em;font-size:13px;color:#04121a;clip-path:polygon(16px 0%,100% 0%,calc(100% - 16px) 100%,0% 100%);background:linear-gradient(135deg,${f.accent},${hexToRgba(f.accent, 0.7)});box-shadow:0 0 28px ${hexToRgba(f.accent, 0.4)};transition:transform .15s;`)}>TRAIN WITH {f.name.toUpperCase()} ▸</button>
                </div>
              </div>

              {/* constellation roster */}
              <div style={css('text-align:center;margin-top:70px;')}>
                <span style={css("font-family:'Chakra Petch';font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#5ce1ff;")}>The full roster</span>
                <h3 style={css("font-family:'Anton';font-size:clamp(26px,3.4vw,40px);color:#eaf6ff;margin:6px 0 0;transform:skewX(-5deg);")}>TAP A COACH TO SCOUT THEM</h3>
              </div>
              <div className="ccv-constellation" style={css('position:relative;height:340px;max-width:1000px;margin:24px auto 0;')}>
                <svg viewBox="0 0 1000 360" preserveAspectRatio="none" style={css('position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;')}>
                  <polyline points={cpts.map((p) => p.join(',')).join(' ')} fill="none" stroke="rgba(56,232,255,.32)" strokeWidth={1.6} strokeDasharray="4 9" />
                  {cpts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={2.6} fill="rgba(56,232,255,.6)" />)}
                </svg>
                {COACHES.map((c, i) => {
                  const active = i === idx
                  const sz = active ? 98 : 66
                  return (
                    <div key={c.id} onClick={() => setCoach(i)} style={css(`position:absolute;left:${nodePos[i][0]}%;top:${nodePos[i][1]}%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:10px;cursor:pointer;z-index:3;`)}>
                      <div style={css(`width:${sz}px;height:${sz}px;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle at 50% 38%,${hexToRgba(c.accent, 0.32)},rgba(8,13,26,.94));border:2px solid ${active ? c.accent : hexToRgba(c.accent, 0.45)};box-shadow:${active ? `0 0 0 4px ${hexToRgba(c.accent, 0.16)},0 0 40px ${hexToRgba(c.accent, 0.6)}` : '0 8px 22px rgba(0,0,0,.5)'};transition:all .25s;`)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`${PIECE_SET}/${c.piece}.svg`} alt={c.name} style={css(`width:64%;height:80%;object-fit:contain;filter:drop-shadow(0 6px 14px ${hexToRgba(c.accent, 0.55)});`)} />
                      </div>
                      <div style={css(`font-family:'Chakra Petch';font-weight:700;font-size:12px;letter-spacing:.07em;text-transform:uppercase;color:${active ? '#eaf6ff' : '#7f94ad'};`)}>{c.name}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* GAME MODES */}
          <section id="modes" className="ccv-sec" style={css('position:relative;z-index:5;max-width:1280px;margin:0 auto;padding:80px 40px 40px;')}>
            <div style={css('text-align:center;margin-bottom:46px;')}>
              <h2 style={css("font-family:'Anton';font-size:clamp(40px,6vw,84px);line-height:.9;letter-spacing:.005em;color:#eaf6ff;transform:skewX(-6deg);")}>CHOOSE YOUR <span style={{ color: '#5ce1ff' }}>ARENA</span></h2>
            </div>
            <div className="ccv-grid3" style={css('display:grid;grid-template-columns:repeat(3,1fr);gap:20px;')}>
              {MODES.map((m, i) => (
                <div key={i} data-tilt onClick={start} className="ccv-mode" style={css(`position:relative;overflow:hidden;min-height:380px;border-radius:22px;padding:30px;display:flex;flex-direction:column;justify-content:flex-end;background:linear-gradient(165deg,${hexToRgba(m.accent, 0.16)},rgba(8,12,22,.9));border:1px solid ${hexToRgba(m.accent, 0.3)};cursor:pointer;transform:perspective(900px);will-change:transform;box-shadow:0 18px 44px rgba(0,0,0,.4);`)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${PIECE_SET}/${m.piece}.svg`} alt={m.title} style={css(`position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);width:200px;height:240px;object-fit:contain;filter:drop-shadow(0 18px 48px ${hexToRgba(m.accent, 0.4)});`)} />
                  <div style={css('position:relative;z-index:2;')}>
                    <div style={css(`display:inline-flex;padding:5px 12px;border-radius:999px;background:rgba(4,6,15,.55);font-family:'Chakra Petch';font-weight:700;font-size:10px;letter-spacing:.14em;color:${m.accent};text-transform:uppercase;`)}>{m.tag}</div>
                    <h3 style={css("font-family:'Anton';font-size:34px;line-height:1;margin:14px 0 8px;color:#fff;transform:skewX(-5deg);")}>{m.title}</h3>
                    <p style={css('color:#c4d2e2;font-size:15px;line-height:1.55;margin:0;max-width:280px;')}>{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* HOW STEPS */}
          <section id="how" className="ccv-sec" style={css('position:relative;z-index:5;max-width:1180px;margin:0 auto;padding:90px 40px 30px;')}>
            <div style={css('text-align:center;margin-bottom:44px;')}>
              <span style={css("font-family:'Permanent Marker';font-size:24px;color:#38e8ff;text-shadow:0 0 20px rgba(56,232,255,.6);")}>three moves in</span>
              <h2 style={css("font-family:'Anton';font-size:clamp(34px,5vw,68px);line-height:.92;letter-spacing:.005em;color:#eaf6ff;transform:skewX(-6deg);margin:6px 0 0;")}>HOW IT <span style={{ color: '#5ce1ff' }}>WORKS</span></h2>
            </div>
            <div className="ccv-grid3" style={css('display:grid;grid-template-columns:repeat(3,1fr);gap:22px;')}>
              <div style={css('position:relative;overflow:hidden;padding:34px 30px;clip-path:polygon(0 0,100% 0,100% 100%,30px 100%,0 calc(100% - 30px));border-top-left-radius:28px;background:linear-gradient(155deg,rgba(56,232,255,.16),rgba(8,14,28,.9));border:1px solid rgba(56,232,255,.3);')}>
                <div style={css('display:flex;align-items:center;justify-content:space-between;')}>
                  <div style={css("font-family:'Anton';font-size:56px;color:#5ce1ff;line-height:1;text-shadow:0 0 26px rgba(56,232,255,.5);")}>01</div>
                  <div style={css('width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:rgba(56,232,255,.12);border:1px solid rgba(56,232,255,.3);font-size:22px;color:#5ce1ff;')}>⛓</div>
                </div>
                <h3 style={css("font-family:'Chakra Petch';font-weight:700;font-size:22px;color:#fff;margin:18px 0 8px;")}>Connect your wallet</h3>
                <p style={css('color:#b7c5d8;font-size:15px;line-height:1.6;margin:0;')}>MiniPay, MetaMask, or any EVM wallet. New here? Grab 1,000 free CHESS to start.</p>
              </div>
              <div style={css('position:relative;overflow:hidden;padding:34px 30px;clip-path:polygon(0 0,100% 0,100% 100%,30px 100%,0 calc(100% - 30px));border-top-left-radius:28px;background:linear-gradient(155deg,rgba(124,92,255,.18),rgba(8,14,28,.9));border:1px solid rgba(124,92,255,.34);')}>
                <div style={css('display:flex;align-items:center;justify-content:space-between;')}>
                  <div style={css("font-family:'Anton';font-size:56px;color:#a78bfa;line-height:1;text-shadow:0 0 26px rgba(124,92,255,.5);")}>02</div>
                  <div style={css('width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:rgba(124,92,255,.14);border:1px solid rgba(124,92,255,.34);font-size:22px;color:#c4b5fd;')}>♟</div>
                </div>
                <h3 style={css("font-family:'Chakra Petch';font-weight:700;font-size:22px;color:#fff;margin:18px 0 8px;")}>Pick a coach or stake</h3>
                <p style={css('color:#b7c5d8;font-size:15px;line-height:1.6;margin:0;')}>Train with a coach, or wager CHESS and jump straight into a ranked match.</p>
              </div>
              <div style={css('position:relative;overflow:hidden;padding:34px 30px;clip-path:polygon(0 0,100% 0,100% 100%,30px 100%,0 calc(100% - 30px));border-top-left-radius:28px;background:linear-gradient(155deg,rgba(52,211,153,.16),rgba(8,14,28,.9));border:1px solid rgba(52,211,153,.32);')}>
                <div style={css('display:flex;align-items:center;justify-content:space-between;')}>
                  <div style={css("font-family:'Anton';font-size:56px;color:#34d399;line-height:1;text-shadow:0 0 26px rgba(52,211,153,.5);")}>03</div>
                  <div style={css('width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:rgba(52,211,153,.13);border:1px solid rgba(52,211,153,.32);font-size:22px;color:#34d399;')}>♚</div>
                </div>
                <h3 style={css("font-family:'Chakra Petch';font-weight:700;font-size:22px;color:#fff;margin:18px 0 8px;")}>Play, learn &amp; earn</h3>
                <p style={css('color:#b7c5d8;font-size:15px;line-height:1.6;margin:0;')}>Every move is recorded on-chain. Climb the Elo ladder — the winnings are yours.</p>
              </div>
            </div>
          </section>

          {/* PLAYS NICE WITH */}
          <section className="ccv-sec" style={css('position:relative;z-index:5;max-width:1180px;margin:0 auto;padding:90px 40px 30px;')}>
            <div style={css("font-family:'Permanent Marker';font-size:22px;color:#38e8ff;text-shadow:0 0 18px rgba(56,232,255,.6);transform:rotate(-3deg);margin:0 0 16px 8px;display:inline-block;")}>no friction</div>
            <div className="ccv-bento ccv-bento-fb" style={css('position:relative;display:grid;grid-template-columns:repeat(8,1fr);grid-auto-rows:12.5vw;background:#04060d;border-top:1px solid rgba(255,255,255,.06);border-left:1px solid rgba(255,255,255,.06);')}>
              {BENTO.map((cell, i) => {
                if (cell.k === 'head') return (
                  <div key={i} className="ccv-bcell" style={css('grid-column:span 2;justify-content:flex-start;padding:0 clamp(14px,2.4vw,28px);')}>
                    <h2 style={css("font-family:'Anton';font-size:clamp(22px,3.4vw,50px);line-height:.92;color:#f3f7fc;transform:skewX(-5deg);margin:0;")}>PLAYS NICE<br /><span style={{ color: '#5ce1ff' }}>WITH.</span></h2>
                  </div>
                )
                if (cell.k === 'feat') return (
                  <div key={i} className="ccv-bcell" style={css('grid-column:span 2;justify-content:flex-start;gap:clamp(10px,1.6vw,18px);padding:0 clamp(14px,2.4vw,26px);background:linear-gradient(135deg,rgba(56,232,255,.16),rgba(8,14,28,.25));')}>
                    <div>
                      <div style={css("font-family:'Chakra Petch';font-size:clamp(8px,1.1vw,10px);letter-spacing:.16em;color:#7f94ad;text-transform:uppercase;")}>Daily drop</div>
                      <div style={css("font-family:'Anton';font-size:clamp(24px,3.2vw,42px);line-height:.95;color:#fff;")}>1,000</div>
                      <div style={css("font-family:'Chakra Petch';font-weight:600;font-size:clamp(9px,1.2vw,12px);letter-spacing:.1em;color:#5ce1ff;")}>FREE CHESS</div>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${PIECE_SET}/wK.svg`} alt="" style={css('margin-left:auto;width:clamp(26px,3.4vw,46px);height:auto;object-fit:contain;opacity:.5;filter:drop-shadow(0 0 10px rgba(56,232,255,.5));')} />
                  </div>
                )
                if (cell.k === 'a') return <div key={i} className="ccv-bcell" style={css(`background:${cell.c};`)} />
                if (cell.k === 'logo') return (
                  <div key={i} className="ccv-bcell ccv-blogo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cell.logo!.src} alt={cell.logo!.name} />
                    <span className="ccv-blabel">{cell.logo!.name}</span>
                  </div>
                )
                return <div key={i} className="ccv-bcell" />
              })}
            </div>
          </section>

          {/* FOOTER */}
          <footer className="ccv-footer" style={css('position:relative;z-index:5;border-top:1px solid rgba(120,200,255,.07);padding:30px 40px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;')}>
            <div style={css('display:flex;align-items:center;gap:12px;')}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/chessify.png" alt="Chessify" style={css('height:26px;width:auto;object-fit:contain;')} />
              <span style={css('font-size:13px;color:#5b7290;')}>© 2025 Chess Protocol</span>
            </div>
            <div style={css('display:flex;align-items:center;gap:clamp(16px,3vw,28px);flex-wrap:wrap;justify-content:center;')}>
              <div style={css("display:flex;gap:24px;font-family:'Chakra Petch';font-size:13px;font-weight:600;letter-spacing:.06em;color:#7f94ad;text-transform:uppercase;")}>
                <span className="ccv-link" onClick={start} style={{ cursor: 'pointer' }}>Play</span>
                <span className="ccv-link" onClick={() => scrollTo('coaches')} style={{ cursor: 'pointer' }}>Coaches</span>
                <span className="ccv-link" onClick={() => scrollTo('modes')} style={{ cursor: 'pointer' }}>Arena</span>
                <span className="ccv-link" onClick={() => scrollTo('how')} style={{ cursor: 'pointer' }}>Docs</span>
              </div>
              <div style={css('display:flex;align-items:center;gap:10px;')}>
                <a href="https://github.com/jadonamite/playchessify" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="ccv-icon" style={css('width:36px;height:36px;border-radius:10px;border:1px solid rgba(120,200,255,.18);background:rgba(10,18,32,.7);display:flex;align-items:center;justify-content:center;color:#9fb2c8;')}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.27-.01-1.16-.02-2.1-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 2.9-.39c.98 0 1.97.13 2.9.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z"/></svg>
                </a>
                <a href="https://x.com/playchessify" target="_blank" rel="noopener noreferrer" aria-label="X" className="ccv-icon" style={css('width:36px;height:36px;border-radius:10px;border:1px solid rgba(120,200,255,.18);background:rgba(10,18,32,.7);display:flex;align-items:center;justify-content:center;color:#9fb2c8;')}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.656l-5.214-6.817-5.966 6.817H1.683l7.73-8.835L1.254 2.25h6.826l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg>
                </a>
              </div>
            </div>
          </footer>

        </div>

        {/* CONNECT MODAL */}
        {connectOpen && (
          <div onClick={closeConnect} style={css('position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(2,4,10,.78);backdrop-filter:blur(10px);')}>
            <div onClick={(e) => e.stopPropagation()} style={css('position:relative;width:100%;max-width:420px;padding:36px;border-radius:22px;background:linear-gradient(180deg,#0b1426,#070d1c);border:1px solid rgba(56,232,255,.28);box-shadow:0 30px 90px rgba(0,0,0,.7);')}>
              <button onClick={closeConnect} style={css('position:absolute;top:18px;right:18px;width:32px;height:32px;border-radius:8px;border:1px solid rgba(120,200,255,.14);background:transparent;color:#9fb2c8;cursor:pointer;font-size:16px;')}>✕</button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${PIECE_SET}/wK.svg`} alt="" style={css('width:40px;height:48px;object-fit:contain;filter:drop-shadow(0 0 16px rgba(56,232,255,.7));')} />
              <h3 style={css("font-family:'Anton';font-size:30px;color:#fff;margin:12px 0 6px;letter-spacing:.01em;")}>CONNECT WALLET</h3>
              <p style={css('color:#a7b8cd;font-size:14px;line-height:1.5;margin:0 0 24px;')}>Pick a wallet to start playing. No wallet? Grab 1,000 free CHESS to begin.</p>
              <div style={css('display:flex;flex-direction:column;gap:10px;')}>
                <button className="ccv-wallet" onClick={connectWallet} style={css("display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-radius:12px;border:1px solid rgba(52,211,153,.4);background:rgba(52,211,153,.06);color:#eafff6;font-family:'Chakra Petch';font-size:15px;font-weight:700;cursor:pointer;")}><span>MiniPay</span><span style={{ color: '#34d399' }}>▸</span></button>
                <button className="ccv-wallet" onClick={connectWallet} style={css("display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-radius:12px;border:1px solid rgba(251,191,36,.4);background:rgba(251,191,36,.06);color:#fff6e6;font-family:'Chakra Petch';font-size:15px;font-weight:700;cursor:pointer;")}><span>MetaMask</span><span style={{ color: '#fbbf24' }}>▸</span></button>
                <button className="ccv-wallet" onClick={connectWallet} style={css("display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-radius:12px;border:1px solid rgba(56,232,255,.4);background:rgba(56,232,255,.06);color:#e6fbff;font-family:'Chakra Petch';font-size:15px;font-weight:700;cursor:pointer;")}><span>Any EVM Wallet</span><span style={{ color: '#5ce1ff' }}>▸</span></button>
              </div>
              <div style={css('text-align:center;margin-top:20px;font-size:12px;color:#5b7290;')}>Secured on Celo Mainnet · 0% platform fees</div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
