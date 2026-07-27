import ClayCard from '@/components/ui/ClayCard'
import GlowButton from '@/components/ui/GlowButton'
import { TOKEN_DECIMALS } from '@/config/contracts'
import { motion } from 'framer-motion'
import { type GameData } from './types'
import { useToastStore } from '@/hooks/useToastStore'

interface GameSidebarProps {
  canJoinFromPage: boolean
  gameIsWaiting: boolean
  isCreator: boolean
  isBotGame: boolean
  gameOver: boolean
  contractActive: boolean
  isMyTurn: boolean
  isConnected: boolean
  canAct: boolean
  iProposedDraw: boolean
  opponentProposedDraw: boolean
  gameData: GameData | null
  gameId: number
  txPending: boolean
  turn: 'w' | 'b'
  turnSecondsLeft: number
  relayError: unknown
  hintMove: { from: string; to: string } | null
  isHintLoading: boolean
  moveHistory: string[]
  onJoinMatch: () => void
  onResetBot: () => void
  onHint: () => void
  onProposeDraw: () => void
  onAcceptDraw: () => void
  onResign: () => void
  onConnectWallet: () => void
}

// Right-column context for PvP games only (bot games render no sidebar). The
// hold-to-quit (resign) and hint actions live in the bottom GameActionBar, so
// this column carries only join/waiting state, the turn clock, and draw offers.
export default function GameSidebar(props: GameSidebarProps) {
  const {
    canJoinFromPage, gameIsWaiting, isCreator, gameOver, contractActive,
    isMyTurn, isConnected, canAct, iProposedDraw, opponentProposedDraw,
    gameData, gameId, txPending, turnSecondsLeft, relayError,
    onJoinMatch, onProposeDraw, onAcceptDraw, onConnectWallet,
  } = props
  const showToast = useToastStore((s) => s.showToast)

  return (
    <div className="lg:col-span-4 space-y-4">

      {/* Context-aware action area */}
      {canJoinFromPage ? (
        <ClayCard className="p-4 md:p-6">
          <p className="text-[10px] font-black tracking-[0.2em] text-[var(--t3)] uppercase mb-3">Open Challenge</p>
          <p className="text-xs text-[var(--t2)] mb-1">
            Wager: <span className="text-[var(--c)] font-black">{(Number(gameData?.wager ?? 0) / Math.pow(10, TOKEN_DECIMALS)).toFixed(0)} CHESS</span>
          </p>
          <p className="text-[10px] text-[var(--t3)] mb-5 leading-relaxed">Accepting locks the matching wager from your wallet.</p>
          <GlowButton variant="brand" fullWidth parallelogram loading={txPending} onClick={onJoinMatch}>
            CONFIRM JOIN
          </GlowButton>
        </ClayCard>

      ) : gameIsWaiting && isCreator ? (
        <ClayCard className="p-4 md:p-6">
          <p className="text-[10px] font-black tracking-[0.2em] text-[var(--t3)] uppercase mb-3">Waiting for Opponent</p>
          <p className="text-xs text-[var(--t2)] mb-4 leading-relaxed">Share your match ID so they can join.</p>
          <div className="flex items-center gap-2 bg-black/40 rounded-xl p-3 border border-white/10 mb-5">
            <span className="text-2xl font-black text-[var(--c)] tracking-widest flex-1 text-center" style={{ fontFamily: 'var(--fd)' }}>
              #{gameId}
            </span>
            <button
              onClick={() => { navigator.clipboard.writeText(String(gameId)); showToast('Match ID copied!', 'info') }}
              className="text-[9px] font-black tracking-widest uppercase text-[var(--t3)] hover:text-[var(--c)] transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
            >
              COPY
            </button>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--c)] animate-pulse" />
            <span className="text-[10px] text-[var(--t3)] tracking-widest uppercase font-bold">Watching for opponent…</span>
          </div>
        </ClayCard>

      ) : (
        /* PvP active game */
        <>
          {/* Turn state */}
          {!gameOver && contractActive && (
            <ClayCard className="p-5">
              {isMyTurn ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_#4ade80]" />
                    <span className="text-[10px] font-black tracking-[0.2em] text-green-400 uppercase">Your Turn</span>
                  </div>
                  <p className="text-[11px] text-[var(--t3)] leading-relaxed">
                    Drag or click a piece to move. Opponent sees it automatically.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-[10px] font-black tracking-[0.2em] text-amber-400 uppercase">Opponent&apos;s Turn</span>
                  </div>
                  <p className="text-[11px] text-[var(--t3)] leading-relaxed">Waiting for their move…</p>
                  {/* Countdown */}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[9px] text-[var(--t3)] uppercase font-bold tracking-widest">Time limit</span>
                    <span className={`text-sm font-black font-mono tabular-nums ${
                      turnSecondsLeft < 60 ? 'text-red-400' : turnSecondsLeft < 120 ? 'text-amber-400' : 'text-[var(--t2)]'
                    }`}>
                      {Math.floor(turnSecondsLeft / 60)}:{String(turnSecondsLeft % 60).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
                    <div className={`w-1.5 h-1.5 rounded-full ${relayError ? 'bg-red-400' : 'bg-[var(--c)] animate-pulse'}`} />
                    <span className={`text-[9px] font-bold tracking-widest uppercase ${relayError ? 'text-red-400' : 'text-[var(--c)]'}`}>
                      {relayError ? 'Relay offline' : 'Live sync active'}
                    </span>
                  </div>
                </div>
              )}
            </ClayCard>
          )}

          {/* Draw offer — only available during active play */}
          {contractActive && !gameOver && (
            <ClayCard className="p-5">
              <p className="text-[10px] font-black tracking-[0.2em] text-[var(--t3)] uppercase mb-3">Draw</p>
              {opponentProposedDraw ? (
                <>
                  <p className="text-[11px] text-[var(--t3)] mb-3 leading-relaxed">
                    Your opponent has offered a draw. Accepting refunds both wagers.
                  </p>
                  <GlowButton variant="brand" fullWidth disabled={!canAct} loading={txPending} onClick={onAcceptDraw}>
                    ACCEPT DRAW
                  </GlowButton>
                </>
              ) : iProposedDraw ? (
                <div className="flex items-center justify-center gap-2 py-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--c)] animate-pulse" />
                  <span className="text-[var(--c)] text-xs font-black tracking-widest uppercase">
                    Draw offer sent — waiting for opponent
                  </span>
                </div>
              ) : (
                <>
                  <GlowButton variant="ghost" fullWidth disabled={!canAct} loading={txPending} onClick={onProposeDraw}>
                    OFFER DRAW
                  </GlowButton>
                  <p className="text-[9px] text-[var(--t3)] text-center mt-2 opacity-50">
                    If accepted, both wagers are refunded.
                  </p>
                </>
              )}
            </ClayCard>
          )}
        </>
      )}

      {/* Wallet connect nudge */}
      {!isConnected && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-center flex flex-col gap-3 items-center"
        >
          <span className="text-yellow-200/70 text-[10px] uppercase font-bold tracking-widest">Wallet required</span>
          <GlowButton variant="brand" size="sm" onClick={onConnectWallet}>CONNECT WALLET</GlowButton>
        </motion.div>
      )}
    </div>
  )
}
