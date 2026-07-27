'use client'

import { motion } from 'framer-motion'
import { BOARD_THEMES, type PieceSet } from '@/hooks/useSettingsStore'
import { piecePath } from '@/lib/chessPieces'

/**
 * Shatters the mated king in place on the board. Overlays the king square with a
 * square-coloured tile (which "erases" the real king still sitting underneath),
 * stacks fragments of the king image on top, then bursts them outward with a
 * little gravity and spin. Purely presentational, pointer-events: none.
 */

// Eight wedge fragments fanning from the cell centre to its perimeter — together
// they tile the whole square, so the stacked fragments reproduce the king glyph.
// Each carries an outward burst direction (dx, dy) roughly toward its own edge.
const PERIM: Array<[number, number]> = [
  [0, 0], [50, 0], [100, 0], [100, 50], [100, 100], [50, 100], [0, 100], [0, 50],
]
const SHARDS = PERIM.map((p, i) => {
  const q = PERIM[(i + 1) % PERIM.length]
  const clip = `polygon(50% 50%, ${p[0]}% ${p[1]}%, ${q[0]}% ${q[1]}%)`
  // Outward direction = midpoint of the wedge's outer edge, relative to centre.
  const mx = (p[0] + q[0]) / 2 - 50
  const my = (p[1] + q[1]) / 2 - 50
  const mag = Math.hypot(mx, my) || 1
  return { clip, nx: mx / mag, ny: my / mag, spin: (i % 2 ? 1 : -1) * (120 + i * 22) },
})

const CELL = 12.5 // one square = 1/8 of the board, in %

interface Props {
  square: string                       // e.g. "e8" — the mated king's square
  color: 'w' | 'b'                     // mated king colour
  orientation: 'white' | 'black'       // board orientation
  boardTheme: keyof typeof BOARD_THEMES
  pieceSet: PieceSet
}

export default function KingShatter({ square, color, orientation, boardTheme, pieceSet }: Props) {
  const file = square.charCodeAt(0) - 97 // a-h → 0-7
  const rank = Number(square[1])         // 1-8
  if (file < 0 || file > 7 || !(rank >= 1 && rank <= 8)) return null

  const colIndex = orientation === 'black' ? 7 - file : file
  const rowIndex = orientation === 'black' ? rank - 1 : 8 - rank
  const left = colIndex * CELL
  const top = rowIndex * CELL

  const isLight = (file + rank) % 2 === 0
  const squareColor = isLight ? BOARD_THEMES[boardTheme].light : BOARD_THEMES[boardTheme].dark
  const kingImg = piecePath(pieceSet, color === 'w' ? 'wK' : 'bK')

  const cellStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${left}%`,
    top: `${top}%`,
    width: `${CELL}%`,
    height: `${CELL}%`,
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden>
      {/* Tile that erases the real king underneath once the shards fly off. */}
      <motion.div
        style={{ ...cellStyle, backgroundColor: squareColor }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18, delay: 0.16 }}
      />

      {/* Flash at the moment of impact. */}
      <motion.div
        style={{
          ...cellStyle,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(167,139,250,0.5) 45%, transparent 70%)',
        }}
        initial={{ opacity: 0.9, scale: 0.4 }}
        animate={{ opacity: 0, scale: 2.2 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />

      {/* King fragments. */}
      {SHARDS.map((s, i) => (
        <motion.div
          key={i}
          style={{ ...cellStyle, clipPath: s.clip, WebkitClipPath: s.clip }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 }}
          animate={{
            x: [0, s.nx * 26, s.nx * 46],
            y: [0, s.ny * 26 - 10, s.ny * 46 + 70], // burst out, then gravity pulls down
            rotate: [0, s.spin * 0.5, s.spin],
            opacity: [1, 1, 0],
            scale: [1, 1, 0.7],
          }}
          transition={{ duration: 1.25, ease: 'easeOut', times: [0, 0.45, 1] }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG shard */}
          <img
            src={kingImg}
            alt=""
            draggable={false}
            style={{ width: '100%', height: '100%', userSelect: 'none' }}
          />
        </motion.div>
      ))}
    </div>
  )
}
