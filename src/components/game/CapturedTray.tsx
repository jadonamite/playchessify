import { type PieceSet } from '@/hooks/useSettingsStore'
import { piecePath } from '@/lib/chessPieces'

export default function CapturedTray({ pieces, color, advantage, set }: { pieces: string[]; color: 'w' | 'b'; advantage: number; set: PieceSet }) {
  return (
    <div className="flex items-center gap-2 min-h-[22px]">
      <div className="flex items-center">
        {pieces.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- dynamic SVG piece sprite, next/image unsuitable
          <img
            key={i}
            src={piecePath(set, `${color}${p.toUpperCase()}`)}
            alt={p}
            draggable={false}
            className="w-[18px] h-[18px] -mr-1.5 last:mr-0 drop-shadow"
          />
        ))}
      </div>
      {advantage > 0 && (
        <span className="text-[11px] font-black tabular-nums text-[var(--c)]">+{advantage}</span>
      )}
    </div>
  ),
}
