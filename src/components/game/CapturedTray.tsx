import { type PieceSet } from '@/hooks/useSettingsStore'
import { piecePath } from '@/lib/chessPieces'

const renderPiece = (set: PieceSet, color: 'w' | 'b', piece: string) => (
  // eslint-disable-next-line @next/next/no-img-element -- dynamic SVG piece sprite, next/image unsuitable
  <img
    src={piecePath(set, `${color}${piece.toUpperCase()}`)}
    alt={piece}
    draggable={false}
    className="w-[18px] h-[18px] -mr-1.5"
  />
)

export default function CapturedTray({ pieces, color, advantage, set }: { pieces: string[]; color: 'w' | 'b'; advantage: number; set: PieceSet }) {
  return (
    <div className="flex items-center gap-2 min-h-[22px]">
      <div className="flex items-center">
        {pieces.map((p, i) => (
          <span key={i} className={i === pieces.length - 1 ? '' : 'mr-1.5'}>
            {renderPiece(set, color, p)}
          </span>
        ))}
      </div>
      {advantage > 0 && (
        <span className="text-[11px] font-black tabular-nums text-[var(--c)]">+{advantage}</span>
      )}
    </div>
  )
}