import { type PieceSet } from '@/hooks/useSettingsStore'
import { piecePath } from '@/lib/chessPieces'

const PieceImage = ({ piece, color, set }: { piece: string; color: 'w' | 'b'; set: PieceSet }) => (
  <img
    src={piecePath(set, `${color}${piece.toUpperCase()}`)}
    alt={piece}
    draggable={false}
    className="w-[18px] h-[18px] -mr-1.5 drop-shadow"
  />
)

export default function CapturedTray({ pieces, color, advantage, set }: { pieces: string[]; color: 'w' | 'b'; advantage: number; set: PieceSet }) {
  return (
    <div className="flex items-center gap-2 min-h-[22px]">
      <div className="flex items-center">
        {pieces.map((p, i) => (
          <PieceImage key={i} piece={p} color={color} set={set} />
        ))}
      </div>
      {advantage > 0 && (
        <span className="text-[11px] font-black tabular-nums text-[var(--c)]">+{advantage}</span>
      )}
    </div>
  )
}