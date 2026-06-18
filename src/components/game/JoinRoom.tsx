'use client'

import { motion } from 'framer-motion'
import type { ChessProfile } from '@/types/profile'
import GlowButton from '@/components/ui/GlowButton'
import ChessAvatar from '@/components/ui/ChessAvatar'
import ChessName from '@/components/ui/ChessName'
import { TOKEN_DECIMALS } from '@/config/contracts'

interface JoinRoomProps {
  gameId: number
  creatorAddress: string
  wagerRaw: bigint | number
  profileMap: Record<string, ChessProfile | null>
  txPending: boolean
  isConnected: boolean
  onJoin: () => void
  onConnectWallet: () => void
  onLeave: () => void
}

export default function JoinRoom({
  gameId, creatorAddress, wagerRaw, profileMap, txPending,
  isConnected, onJoin, onConnectWallet, onLeave,
}: JoinRoomProps) {
  const wager = Number(wagerRaw) / Math.pow(10, TOKEN_DECIMALS)
  const pot = wager * 2
  const accent: string = 'var(--candy-amber)'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[55] flex items-center justify-center px-5 overflow-y-auto bg-[var(--bg)]"
    >
      {/* grid backdrop */}
      <div
        className="absolute inset-0 pointer-events-none z-0 opacity-40"
        style={{ backgroundImage: 'linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px)', backgroundSize: '52px 52px' }}
      />

      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-6 py-10">

        {/* swords icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 20 }}
          className="text-5xl"
          style={{ filter: 'drop-shadow(0 4px 12px rgba(0,204,255,0.3))' }}
        >
          ⚔️
        </motion.div>

        {/* heading */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white" style={{ fontFamily: 'var(--fd)', textShadow: 'var(--king-text-shadow)' }}>
            Open Challenge
          </h2>
          <p className="text-[10px] font-black tracking-[0.25em] text-[var(--t3)] uppercase">
            MATCH #{gameId}
          </p>
        </div>

        {/* challenger card */}
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="w-full flex flex-col items-center gap-4 p-5 rounded-2xl bg-black/40 border border-white/8"
        >
          <span className="text-[9px] font-black tracking-[0.3em] uppercase text-[var(--t3)]">
            Created by
          </span>
          <div className="flex items-center gap-3">
            <div
              className="rounded-[22%] overflow-hidden"
              style={{ boxShadow: '0 0 0 2px rgba(0,204,255,0.3), 0 8px 24px rgba(0,204,255,0.15)' }}
            >
              <ChessAvatar address={creatorAddress} size={56} />
            </div>
            <div className="flex flex-col gap-0.5">
              <ChessName
                address={creatorAddress}
                profile={profileMap[creatorAddress.toLowerCase()]}
                className="text-sm font-black text-white"
              />
              <span className="text-[9px] text-[var(--t3)] font-mono">
                {creatorAddress.slice(0, 6)}…{creatorAddress.slice(-4)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* wager info */}
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="w-full grid grid-cols-2 gap-3"
        >
          <div
            className="flex flex-col items-center gap-0.5 py-3 rounded-2xl"
            style={{ background: 'color-mix(in srgb, var(--c) 10%, rgba(0,0,0,0.5))', border: '1px solid color-mix(in srgb, var(--c) 30%, transparent)' }}
          >
            <span className="text-[9px] font-black tracking-[0.25em] uppercase text-[var(--c)]" style={{ fontFamily: 'var(--fd)' }}>
              Entry Fee
            </span>
            <span className="text-lg font-black text-white leading-none" style={{ fontFamily: 'var(--fd)' }}>
              {wager.toFixed(0)} <span className="text-[11px] text-[var(--c)]">CHESS</span>
            </span>
          </div>
          <div
            className="flex flex-col items-center gap-0.5 py-3 rounded-2xl"
            style={{ background: `color-mix(in srgb, ${accent} 12%, rgba(0,0,0,0.5))`, border: `1px solid color-mix(in srgb, ${accent} 38%, transparent)` }}
          >
            <span className="text-[9px] font-black tracking-[0.25em] uppercase" style={{ color: accent, fontFamily: 'var(--fd)' }}>
              Winner Takes
            </span>
            <span className="text-lg font-black text-white leading-none" style={{ fontFamily: 'var(--fd)' }}>
              {pot.toFixed(0)} <span className="text-[11px]" style={{ color: accent }}>CHESS</span>
            </span>
          </div>
        </motion.div>

        {/* disclaimer */}
        <p className="text-[10px] text-[var(--t3)] text-center leading-relaxed max-w-xs">
          Joining locks <span className="text-[var(--c)] font-bold">{wager.toFixed(0)} CHESS</span> from your wallet as your wager. The match begins immediately once confirmed on-chain.
        </p>

        {/* action */}
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="w-full flex flex-col gap-3 pt-2"
        >
          {isConnected ? (
            <GlowButton variant="brand" fullWidth parallelogram loading={txPending} onClick={onJoin}>
              ⚔ ACCEPT CHALLENGE
            </GlowButton>
          ) : (
            <GlowButton variant="brand" fullWidth parallelogram onClick={onConnectWallet}>
              CONNECT WALLET TO JOIN
            </GlowButton>
          )}
          <GlowButton variant="ghost" fullWidth onClick={onLeave}>← BACK TO LOBBY</GlowButton>
        </motion.div>
      </div>
    </motion.div>
  )
}
