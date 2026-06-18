import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChessProfile } from '@/types/profile';
import ChessAvatar from '@/components/ui/ChessAvatar';
import ChessName from '@/components/ui/ChessName';
import { usePlayerStats } from '@/hooks/usePlayerStats';

// ... (rest of the code remains the same)

function useCountdown(onDone: () => void) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setCount(3), 1300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (count === null) return;
    if (count <= 0) {
      onDone();
      return;
    }
    const t = setTimeout(() => setCount((c) => (c === null ? null : c - 1)), 750);
    return () => clearTimeout(t);
  }, [count, onDone]);

  return count;
}

function MatchIntroInner({
  myAddress,
  opponentAddress,
  myColor,
  pot,
  profileMap,
  onDone,
}: Omit<MatchIntroProps, 'open'>) {
  const isDesktop = useIsDesktop();
  const count = useCountdown(onDone);
  const oppColor: Color = myColor === 'white' ? 'black' : 'white';

  // ... (rest of the code remains the same)
}