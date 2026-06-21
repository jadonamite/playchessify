const PIECES = ['♟', '♞', '♝', '♜', '♛', '♚']

export function avatarDataUrl(address: string, size = 100): string {
  const svg = generateAvatarSvg(address, size)
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.min(255, v).toString(16).padStart(2, '0')).join('')}`
}

export function avatarSvgUrl(address: string): string {
  const svg = generateAvatarSvg(address)
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}


  // Derive two distinct colours from address bytes
  const r1 = addrByte(addr, 1)
  const g1 = addrByte(addr, 2)
  const b1 = addrByte(addr, 3)

  // Shift hue for second colour so they're always visually different
  const r2 = (addrByte(addr, 4) + 80) % 256
  const g2 = (addrByte(addr, 5) + 60) % 256
  const b2 = (addrByte(addr, 6) + 100) % 256

  const c1 = toHex(r1, g1, b1)
  const c2 = toHex(r2, g2, b2)

  const piece = PIECES[addrByte(addr, 7) % 6]
  const id = addr.slice(2, 8) // unique gradient id per address

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>
    <radialGradient id="g${id}" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </radialGradient>
  </defs>
  <rect width="100" height="100" rx="22" fill="url(#g${id})"/>
  <rect width="100" height="100" rx="22" fill="rgba(0,0,0,0.18)"/>
  <text x="50" y="67" text-anchor="middle" font-size="48" fill="rgba(255,255,255,0.88)" font-family="serif">${piece}</text>
</svg>`
}

export function generateAvatarSvg(address: string, size = 100): string {
  const addr = address.toLowerCase()

function addrByte(addr: string, idx: number): number {
  const hex = addr.replace('0x', '').toLowerCase()
  return parseInt(hex.slice(idx * 2, idx * 2 + 2) || '00', 16)
}