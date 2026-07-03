'use client'

import { PieceIcon } from './ChessModels'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

export type PromotionPiece = 'q' | 'r' | 'b' | 'n'

interface PromotionModalProps {
  open: boolean
  color: 'white' | 'black'
  onSelect: (piece: PromotionPiece) => void
  onCancel: () => void
}

const OPTIONS: Array<{
  piece: PromotionPiece
  label: string
  view: 'queen' | 'rook' | 'bishop' | 'knight'
  hint: string
}> = [
  { piece: 'q', label: 'QUEEN',  view: 'queen',  hint: 'MAX POWER' },
  { piece: 'r', label: 'ROOK',   view: 'rook',   hint: 'LINE LOCK' },
  { piece: 'b', label: 'BISHOP', view: 'bishop', hint: 'DIAGONAL' },
  { piece: 'n', label: 'KNIGHT', view: 'knight', hint: 'FORK TACTIC' },
]

export default function PromotionModal({ open, color, onSelect, onCancel }: PromotionModalProps) {
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration mount flag
  useEffect(() => { setMounted(true) }, [])

  // Keyboard shortcuts: Q/R/B/N pick; Escape cancels
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'q') onSelect('q')
      else if (k === 'r') onSelect('r')
      else if (k === 'b') onSelect('b')
      else if (k === 'n') onSelect('n')
      else if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onSelect, onCancel])

  if (!mounted) return null


  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="m-sheet-wrap fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-md"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="m-sheet w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-950/95 shadow-[0_30px_120px_rgba(0,0,0,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-8 pt-8 pb-4 border-b border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--c)] animate-pulse" />
                <span className="text-[10px] tracking-[0.25em] font-black uppercase text-[var(--c)]">
                  PAWN ASCENDANCE
                </span>
              </div>
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-white leading-none">
                CHOOSE YOUR <span className="text-[var(--c)]">PROMOTION</span>
              </h2>
              <p className="text-xs text-[var(--t3)] mt-2 leading-relaxed">
                Your pawn has reached the final rank. Select the piece it ascends to.
              </p>
            </div>

            {/* Options grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-6">
              {OPTIONS.map(({ piece, label, view, hint }) => (
                <button
                  key={piece}
                  onClick={() => onSelect(piece)}
                  className="group relative flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-[var(--c)]/60 hover:bg-[var(--c)]/5 transition-all duration-200"
                  aria-label={`Promote to ${label}`}
                >
                  {/* Hover glow */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    style={{ boxShadow: '0 0 30px rgba(0, 204, 255, 0.25) inset' }}
                  />

                  <div className="w-20 h-20 transform group-hover:scale-110 transition-transform duration-200">
                    <PieceIcon type={view} color={color} className="w-full h-full" />
                  </div>

                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[11px] font-black tracking-widest text-white uppercase">
                      {label}
                    </span>
                    <span className="text-[9px] font-bold tracking-widest text-[var(--t3)] group-hover:text-[var(--c)] uppercase transition-colors">
                      {hint}
                    </span>
                  </div>

                  {/* Keyboard hint */}
                  <span className="absolute top-2 right-2 text-[9px] font-black text-[var(--t3)] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 tracking-widest">
                    {piece.toUpperCase()}
                  </span>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex items-center justify-between">
              <span className="text-[10px] text-[var(--t3)] tracking-widest uppercase font-bold">
                Press Q · R · B · N · Esc
              </span>
              <button
                onClick={onCancel}
                className="text-[10px] font-black tracking-widest uppercase text-[var(--t3)] hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/5"
              >
                CANCEL
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
