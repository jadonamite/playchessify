import ClayCard from '@/components/ui/ClayCard'

const MoveLogItem = ({ san, index }: { san: string; index: number }) => {
  const isEvenMove = index % 2 === 0;
  return (
    <div key={index} className={`flex items-center gap-2 text-xs font-mono p-1.5 rounded-lg ${isEvenMove ? 'bg-white/5' : ''}`}> 
      <span className="text-[var(--t3)] w-5 text-left shrink-0">{Math.floor(index / 2) + 1}.</span>
      <span className={isEvenMove ? 'text-[var(--t1)]' : 'text-[var(--t2)]'}>{san}</span>
    </div>
  );
};

export default function MoveLog({ moveHistory }: { moveHistory: string[] }) {
  return (
    <ClayCard variant="inset" className="p-5">
      <p className="text-[10px] font-black tracking-[0.2em] text-[var(--t3)] uppercase mb-3">Move Log</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
        {moveHistory.map((san, i) => (
          <MoveLogItem key={i} san={san} index={i} />
        ))}
        {moveHistory.length === 0 && (
          <p className="col-span-2 text-center text-xs text-[var(--t3)] py-4">Waiting for first move…</p>
        )}
      </div>
    </ClayCard>
  );
}