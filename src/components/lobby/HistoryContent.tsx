'use client'

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Float, Environment, Text } from '@react-three/drei'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import GlowButton from '@/components/ui/GlowButton'
import PlayCard from '@/components/ui/PlayCard'
import LoadingState from '@/components/ui/LoadingState'
import { useHistory } from '@/hooks/useHistory'
import { Queen, PieceIcon } from '@/components/ui/ChessModels'
import { useBatchProfiles } from '@/hooks/useBatchProfiles'
import ChessName from '@/components/ui/ChessName'
import SceneBoundary from '@/components/ui/SceneBoundary'

function Scene() {
  return (
    <>
      <ambientLight intensity={1} />
      <pointLight position={[10, 10, 10]} intensity={2} color="#00ccff" />
      <pointLight position={[-10, 5, -10]} intensity={1.5} color="#6a0dad" />
      <Environment files="/textures/environment/city.hdr" />

      {/* Background Hero Piece */}
      <Queen color="#00ccff" emissive="#00ccff" position={[0, -0.5, 0]} floatIntensity={0.8} rotationIntensity={0.4} />

      {/* Floating Background Labels (Polish) */}
      <Float speed={2} rotationIntensity={0.2} floatIntensity={1}>
        <Text
          position={[-4, 2, -2]}
          fontSize={0.8}
          color="#00ccff"
          font="/fonts/font_discovery.woff" // Assuming a custom font exists or using default
          material-toneMapped={false}
          material-transparent={true}
          material-opacity={0.15}
        >
          MASTERS
        </Text>
      </Float>

      <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.5}>
        <Text
          position={[4, -2, -1]}
          fontSize={0.6}
          color="#6a0dad"
          material-transparent={true}
          material-opacity={0.1}
        >
          HISTORY
        </Text>
      </Float>
    </>
  )
}

export function HistoryContent() {
  const router = useRouter()
  const { history, isLoading } = useHistory()
  const opponentAddrs = history
    .map((i) => i.opponent)
    .filter((a) => a.startsWith('0x'))
  const { payload: profileMap = {} } = useBatchProfiles(opponentAddrs)

  return (
    <main className="relative min-h-screen w-full bg-[#06060f] text-[#eeeeff] overflow-x-hidden flex flex-col font-body">
      {/* ── BACKGROUND ── */}
      <div className="fixed inset-0 z-0 h-screen w-full pointer-events-none">
        <SceneBoundary>
          <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
            <Suspense fallback={null}>
              <Scene />
            </Suspense>
          </Canvas>
        </SceneBoundary>
      </div>

      {/* ── GRID OVERLAY ── */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px)', backgroundSize: '52px 52px', pointerEvents: 'none', zIndex: 0, opacity: 0.4 }} />

      <div className="relative z-10 flex-1 flex flex-col items-center w-full max-w-full box-border px-4 md:px-8 py-12 md:py-24">
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-8">

          {/* Header Row */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <GlowButton variant="ghost" size="sm" onClick={() => router.push('/app/lobby')}>
                ← BACK TO LOBBY
              </GlowButton>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center md:text-right">
              <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter" style={{ fontFamily: 'var(--fd)', textShadow: 'var(--hero-text-shadow)' }}>
                Game <span style={{ color: 'var(--c)', textShadow: 'var(--king-text-shadow)' }}>History</span>
              </h1>
              <p className="text-[11px] font-bold tracking-[0.3em] text-[var(--t3)] uppercase mt-2">Verified On-Chain Architecture</p>
            </motion.div>
          </div>

          {/* History List */}
          <PlayCard size="hero">
            <div className="p-1 md:p-2">
              <div className="flex flex-col">
                {isLoading ? (
                  <LoadingState message="SCANNING BLOCKCHAIN" />
                ) : history.length === 0 ? (
                  <div className="py-32 text-center">
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">No matches found on-chain</p>
                    <p className="text-[10px] text-gray-600 mt-2">Deploy your first challenge to see it here</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    <AnimatePresence mode="popLayout">
                      {history.map((item, idx) => (
                        <motion.div
                          key={item.id + item.timestamp}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ delay: idx * 0.05 }}
                          className="p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex items-center gap-6 w-full sm:w-auto">
                            <div className="w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center border border-white/10 bg-black/40 overflow-hidden relative group p-2.5">
                              <PieceIcon
                                type={item.role.toLowerCase() === 'creator' ? 'king' : 'rook'}
                                className="w-full h-full"
                              />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-white/10 text-white/50">
                                  {item.role}
                                </span>
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate max-w-[150px]">
                                  vs{' '}
                                  {item.opponent.startsWith('0x') ? (
                                    <ChessName
                                      address={item.opponent}
                                      profile={profileMap[item.opponent.toLowerCase()]}
                                      short
                                      asLink
                                    />
                                  ) : item.opponent}
                                </span>
                              </div>
                              <button
                                onClick={() => router.push(`/app/game/${item.id}`)}
                                className="font-black text-xl text-white tracking-tight hover:text-[var(--c)] transition-colors text-left"
                              >
                                MATCH #{item.id}
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between w-full sm:w-auto sm:gap-12 shrink-0">
                            <div className="flex flex-col sm:text-right">
                              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Wager</span>
                              <span className="text-lg font-black text-cyan-400">
                                {item.wager} <span className="text-[10px] opacity-60">CHESS</span>
                              </span>
                            </div>

                            <div className="flex flex-col text-right">
                              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Result</span>
                              <span
                                className="text-sm font-black uppercase px-3 py-1 rounded-lg"
                                style={{
                                  background: item.result === 'win' ? 'rgba(74,222,128,0.12)' :
                                    item.result === 'loss' ? 'rgba(239,68,68,0.12)' :
                                    item.result === 'draw' ? 'rgba(148,163,184,0.12)' :
                                    'rgba(255,255,255,0.06)',
                                  color: item.result === 'win' ? '#4ade80' :
                                    item.result === 'loss' ? '#f87171' :
                                    item.result === 'draw' ? '#94a3b8' :
                                    item.status === 'Active' ? '#22d3ee' : '#6b7280',
                                }}
                              >
                                {item.result === 'win' ? 'WIN' :
                                 item.result === 'loss' ? 'LOSS' :
                                 item.result === 'draw' ? 'DRAW' :
                                 item.status}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          </PlayCard>
        </div>
      </div>
    </main>
  )
}
