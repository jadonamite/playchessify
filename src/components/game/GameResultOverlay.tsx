import { motion, AnimatePresence } from 'framer-motion'
import GlowButton from '@/components/ui/GlowButton'
import { type GameData, type GameResult } from './types'

interface GameResultOverlayProps {
  gameResult: GameResult
  resultMessage: string
  gameData: GameData | null
  wagerFormatted: string
  payoutSettled: boolean
  onBackToLobby: () => void
}

export default function GameResultOverlay({ gameResult, resultMessage, gameData, wagerFormatted, payoutSettled, onBackToLobby }: GameResultOverlayProps) {
  return (
    <AnimatePresence>
      {gameResult && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(6,6,15,0.88)', backdropFilter: 'blur(12px)' }}
        >
          <motion.div
            initial={{ scale: 0.88, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 200 }}
            className="w-full max-w-md rounded-[32px] border overflow-hidden"
            style={{
              background: gameResult === 'won'
                ? 'linear-gradient(145deg,rgba(0,204,255,0.1) 0%,rgba(6,6,15,0.97) 60%)'
                : gameResult === 'lost'
                ? 'linear-gradient(145deg,rgba(239,68,68,0.1) 0%,rgba(6,6,15,0.97) 60%)'
                : 'linear-gradient(145deg,rgba(99,102,241,0.1) 0%,rgba(6,6,15,0.97) 60%)',
              borderColor: gameResult === 'won'
                ? 'rgba(0,204,255,0.25)'
                : gameResult === 'lost'
                ? 'rgba(239,68,68,0.25)'
                : 'rgba(99,102,241,0.25)',
              boxShadow: gameResult === 'won'
                ? '0 0 80px rgba(0,204,255,0.15), 0 40px 80px rgba(0,0,0,0.6)'
                : gameResult === 'lost'
                ? '0 0 80px rgba(239,68,68,0.12), 0 40px 80px rgba(0,0,0,0.6)'
                : '0 40px 80px rgba(0,0,0,0.6)',
            }}
          >
            <div className="p-10 flex flex-col items-center gap-6 text-center">

              {/* Icon */}
              <div
                className="text-7xl leading-none"
                style={{ filter: gameResult === 'won' ? 'drop-shadow(0 0 20px rgba(0,204,255,0.5))' : 'none' }}
              >
                {gameResult === 'won' ? '♛' : gameResult === 'lost' ? '♚' : '♟'}
              </div>

              {/* Result label */}
              <div>
                <p
                  className="text-[10px] font-black tracking-[0.5em] uppercase mb-3"
                  style={{
                    color: gameResult === 'won' ? 'var(--c)' : gameResult === 'lost' ? '#ef4444' : '#818cf8',
                  }}
                >
                  {gameResult === 'won' ? 'VICTORY' : gameResult === 'lost' ? 'DEFEAT' : 'DRAW'}
                </p>
                <h2
                  className="text-5xl font-black uppercase tracking-tighter leading-none"
                  style={{ fontFamily: 'var(--fd)' }}
                >
                  {gameResult === 'won' ? 'You Won' : gameResult === 'lost' ? 'You Lost' : 'Stalemate'}
                </h2>
                <p className="text-sm text-[var(--t3)] mt-3 leading-relaxed">{resultMessage}</p>
              </div>

              {/* Wager chip */}
              {gameData && (
                <div className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10">
                  <p className="text-[9px] text-[var(--t3)] uppercase tracking-widest mb-1">Wager</p>
                  <p
                    className="text-2xl font-black"
                    style={{ fontFamily: 'var(--fd)', color: 'var(--c)' }}
                  >
                    {wagerFormatted} <span className="text-base">CHESS</span>
                  </p>
                </div>
              )}

              {/* Actions — payout is settled automatically by the oracle; the
                  panel below is a passive status driven by the getGame poll. */}
              <div className="flex flex-col gap-3 w-full">
                {gameData && Number(gameData.wager) > 0 && gameResult !== 'lost' && (
                  payoutSettled ? (
                    <div className="flex items-center justify-center gap-2 py-2">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="text-green-400 text-xs font-black tracking-widest uppercase">
                        {gameResult === 'draw' ? 'Wager Refunded' : 'Payout Received'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 py-2">
                      <div className="w-2 h-2 rounded-full bg-[var(--c)] animate-pulse" />
                      <span className="text-[var(--c)] text-xs font-black tracking-widest uppercase">
                        Settling payout…
                      </span>
                    </div>
                  )
                )}
                <GlowButton variant="ghost" fullWidth onClick={onBackToLobby}>
                  BACK TO LOBBY
                </GlowButton>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
