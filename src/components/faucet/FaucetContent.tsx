'use client'

import { useState, Suspense } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Canvas } from '@react-three/fiber'
import { Float, Environment, Text } from '@react-three/drei'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/components/wallet-provider'
import { useWriteContract, useReadContract, usePublicClient } from 'wagmi'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import GlowButton from '@/components/ui/GlowButton'
import LoadingState from '@/components/ui/LoadingState'
import FaucetResultModal, { type FaucetResultType } from '@/components/ui/FaucetResultModal'
import { Navbar } from '@/components/landing/Hero'
import { King, Pawn, Bishop, Knight, PieceView } from '@/components/ui/ChessModels'
import { CHESS_TOKEN_ABI } from '@/config/abis'
import { CELO_CONTRACTS, TOKEN_DECIMALS, FAUCET_AMOUNT, CELO_CHAIN_ID, USDM_ADDRESS, FAUCET_COOLDOWN, BLOCK_TIME_SECS } from '@/config/contracts'
import { formatUnits, encodeFunctionData } from 'viem'

/* ── KEYFRAMES ── */
const KEYFRAMES = `
@keyframes drip-pulse {
  0%, 100% { box-shadow: 0 0 20px rgba(0,204,255,0.3), inset 0 0 20px rgba(0,204,255,0.05); }
  50%      { box-shadow: 0 0 40px rgba(0,204,255,0.6), inset 0 0 30px rgba(0,204,255,0.1); }
}
@keyframes token-float {
  0%, 100% { transform: translateY(0px); }
  50%      { transform: translateY(-8px); }
}
`

/* ── 3D Background Scene ── */
function FaucetScene() {
  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[10, 10, 5]} intensity={2} color="#00ccff" />
      <directionalLight position={[-10, -10, -5]} intensity={1} color="#6a0dad" />
      <Environment files="/textures/environment/city.hdr" />

      {/* Large background king */}
      <King position={[0, -0.5, -2]} color="#0f172a" emissive="#00ccff" emissiveIntensity={0.15} floatSpeed={0.5} floatIntensity={0.3} rotationIntensity={0.1} scale={2.5} />

      {/* Floating accent pieces */}
      <Pawn position={[-4, 2, -3]} color="#1e293b" emissive="#00ccff" emissiveIntensity={0.1} floatSpeed={1.5} floatIntensity={1} rotationIntensity={0.5} />
      <Bishop position={[4, -2, -2]} color="#1e293b" emissive="#6a0dad" emissiveIntensity={0.1} floatSpeed={2} floatIntensity={0.8} rotationIntensity={0.4} />
      <Knight position={[3.5, 2.5, -4]} color="#1e293b" emissive="#00ccff" emissiveIntensity={0.08} floatSpeed={1} floatIntensity={0.6} rotationIntensity={0.3} />

      {/* Floating labels */}
      <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.5}>
        <Text
          position={[-4, 3, -3]}
          fontSize={0.6}
          color="#00ccff"
          material-transparent={true}
          material-opacity={0.08}
        >
          FAUCET
        </Text>
      </Float>
      <Float speed={2} rotationIntensity={0.15} floatIntensity={0.8}>
        <Text
          position={[4, -3, -2]}
          fontSize={0.45}
          color="#6a0dad"
          material-transparent={true}
          material-opacity={0.06}
        >
          CHESS
        </Text>
      </Float>
    </>
  )
}

/* ── TOKEN DISPLAY ── */
function TokenDisplay({ balance }: { balance: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm p-5 flex items-center justify-between"
    >
      <div className="flex flex-col gap-1">
        <span className="text-[9px] font-bold tracking-[0.3em] text-white/40 uppercase" style={{ fontFamily: 'var(--fd)' }}>
          Current Balance
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl md:text-4xl font-black text-white tracking-tight" style={{ fontFamily: 'var(--fd)' }}>
            {balance}
          </span>
          <span className="text-xs font-bold tracking-widest text-[var(--c)] uppercase">CHESS</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2 bg-black/40 py-1.5 px-3 rounded-full border border-white/10 shadow-inner">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--c)] animate-pulse" />
          <span className="text-[10px] tracking-[0.2em] font-bold text-[var(--c)]" style={{ fontFamily: 'var(--fd)' }}>
            CELO
          </span>
        </div>
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════
   MAIN FAUCET CONTENT
   ═══════════════════════════════════════════ */
export default function FaucetContent() {
  const router = useRouter()
  const { isConnected, playerAddress, walletTier, connectWallet } = useWallet()
  const { writeContractAsync } = useWriteContract()
  const { client: smartClient } = useSmartWallets()
  const publicClient = usePublicClient({ chainId: CELO_CHAIN_ID })
  const queryClient = useQueryClient()

  const [isClaiming, setIsClaiming] = useState(false)
  const [resultType, setResultType] = useState<FaucetResultType>(null)
  const [txHash, setTxHash] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [cooldownRemaining, setCooldownRemaining] = useState<string>('')

  // Balance of the on-chain player identity (smart account for Tier A, else the EOA).
  const { data: rawBalance } = useReadContract({
    address: CELO_CONTRACTS.token as `0x${string}`,
    abi: CHESS_TOKEN_ABI,
    functionName: 'balanceOf',
    args: [playerAddress as `0x${string}`],
    chainId: CELO_CHAIN_ID,
    query: { enabled: !!playerAddress },
  })
  const balance = rawBalance !== undefined
    ? formatUnits(rawBalance as bigint, TOKEN_DECIMALS)
    : '—'

  /* ── Claim Handler: Celo ── */
  // Tier-aware dispatch (mirrors useCeloChess.sendWrite):
  //   smart   → Privy smart-wallet client → Pimlico sponsors the userOp, and
  //             msg.sender is the smart account so CHESS lands on the player identity
  //   minipay → legacy tx with feeCurrency = cUSD
  //   eoa     → plain write, user pays
  const claimCelo = async () => {
    const TIMEOUT_MS = 90_000

    let hash: `0x${string}`
    if (walletTier === 'smart' && smartClient) {
      hash = await smartClient.sendTransaction({
        to: CELO_CONTRACTS.token as `0x${string}`,
        data: encodeFunctionData({
          abi: CHESS_TOKEN_ABI,
          functionName: 'faucetClaim',
          args: [],
        }),
      })
    } else if (walletTier === 'minipay') {
      hash = await writeContractAsync({
        address: CELO_CONTRACTS.token as `0x${string}`,
        abi: CHESS_TOKEN_ABI,
        functionName: 'faucetClaim',
        args: [],
        feeCurrency: USDM_ADDRESS,
      } as Parameters<typeof writeContractAsync>[0])
    } else {
      hash = await writeContractAsync({
        address: CELO_CONTRACTS.token as `0x${string}`,
        abi: CHESS_TOKEN_ABI,
        functionName: 'faucetClaim',
        args: [],
      })
    }

    const receiptPromise = publicClient!.waitForTransactionReceipt({ hash })
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)
    )

    const receipt = await Promise.race([receiptPromise, timeoutPromise])
    if (receipt.status !== 'success') throw new Error('Transaction reverted')
    return hash
  }

  // Human-readable time left on the faucet cooldown, e.g. "23h 12m".
  const formatCooldown = (blocksLeft: bigint): string => {
    const secs = Number(blocksLeft) * BLOCK_TIME_SECS
    const h = Math.floor(secs / 3600)
    const m = Math.ceil((secs % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  // Pre-check the on-chain cooldown so a still-locked claim shows the friendly
  // cooldown modal (with time remaining) instead of a raw revert from the wallet.
  // Returns true when the claim is still on cooldown.
  const checkCooldown = async (): Promise<boolean> => {
    if (!publicClient || !playerAddress) return false
    try {
      const [lastClaim, currentBlock] = await Promise.all([
        publicClient.readContract({
          address: CELO_CONTRACTS.token as `0x${string}`,
          abi: CHESS_TOKEN_ABI,
          functionName: 'lastFaucetClaim',
          args: [playerAddress as `0x${string}`],
        }) as Promise<bigint>,
        publicClient.getBlockNumber(),
      ])
      if (lastClaim === 0n) return false
      const elapsed = currentBlock - lastClaim
      if (elapsed >= BigInt(FAUCET_COOLDOWN)) return false
      setCooldownRemaining(formatCooldown(BigInt(FAUCET_COOLDOWN) - elapsed))
      setResultType('cooldown')
      return true
    } catch {
      return false // pre-check is best-effort; fall through to the real claim
    }
  }

  /* ── Main Claim Action ── */
  const handleClaim = async () => {
    if (!isConnected) return
    setIsClaiming(true)
    setErrorMessage('')

    try {
      if (await checkCooldown()) return
      const hash = await claimCelo()
      setTxHash(hash || '')
      setResultType('success')
      // Invalidate every cached query (this page's balance + the lobby's balance/
      // stats) so navigating back to the lobby fetches the fresh on-chain balance
      // instead of serving the stale cache.
      queryClient.invalidateQueries()
    } catch (err) {
      const msg = (err instanceof Error ? err.message : '') || 'Unknown error'

      if (msg === 'TIMEOUT') {
        setResultType('timeout')
      } else if (msg.toLowerCase().includes('cooldown') || msg.toLowerCase().includes('too soon') || msg.toLowerCase().includes('already claimed')) {
        // FaucetCooldown(blocksRemaining) custom error (decoded via the ABI) or
        // an equivalent provider message — show the friendly modal, not the revert.
        setResultType('cooldown')
      } else {
        setErrorMessage(msg.length > 120 ? msg.slice(0, 120) + '...' : msg)
        setResultType('error')
      }
    } finally {
      setIsClaiming(false)
    }
  }

  const faucetAmountFormatted = formatUnits(FAUCET_AMOUNT, TOKEN_DECIMALS)

  return (
    <main className="relative min-h-screen w-full bg-[#06060f] text-[#eeeeff] overflow-x-hidden flex flex-col font-body">
      <style>{KEYFRAMES}</style>

      {/* ── NAVBAR ── */}
      <Navbar />

      {/* ── 3D BACKGROUND ── */}
      <div className="fixed inset-0 z-0 h-screen w-full pointer-events-none">
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
          <Suspense fallback={null}>
            <FaucetScene />
          </Suspense>
        </Canvas>
      </div>

      {/* ── GRID OVERLAY ── */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(var(--grid-line) 1px,transparent 1px),linear-gradient(90deg,var(--grid-line) 1px,transparent 1px)',
        backgroundSize: '52px 52px', pointerEvents: 'none', zIndex: 0, opacity: 0.4,
      }} />

      {/* ── CONTENT ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center w-full max-w-full box-border px-4 md:px-8 py-12 md:py-24">
        <div className="w-full max-w-2xl mx-auto flex flex-col gap-8">

          {/* Header */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <GlowButton variant="ghost" size="sm" onClick={() => router.push('/app/lobby')}>
                ← BACK TO LOBBY
              </GlowButton>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center md:text-right">
              <h1
                className="text-4xl md:text-6xl font-black uppercase tracking-tighter"
                style={{ fontFamily: 'var(--fd)', textShadow: 'var(--hero-text-shadow)' }}
              >
                Token{' '}
                <span style={{ color: 'var(--c)', textShadow: 'var(--king-text-shadow)' }}>Faucet</span>
              </h1>
              <p className="text-[11px] font-bold tracking-[0.3em] text-[var(--t3)] uppercase mt-2">
                Free CHESS Tokens • Daily Drip
              </p>
            </motion.div>
          </div>

          {/* ── MAIN CARD ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-[32px] border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 md:p-10 flex flex-col gap-8">

              {/* Balance Display */}
              <TokenDisplay balance={balance} />

              {/* Drip Amount */}
              <div className="flex flex-col gap-4">
                <span className="text-[10px] font-bold tracking-[0.3em] text-white/40 uppercase" style={{ fontFamily: 'var(--fd)' }}>
                  Drip Amount
                </span>

                <div className="flex items-center justify-center gap-4 py-4">
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    className="flex flex-col items-center gap-2 text-center"
                    style={{ animation: 'token-float 3s ease-in-out infinite' }}
                  >
                    <span
                      className="text-5xl md:text-7xl font-black tracking-tight"
                      style={{
                        fontFamily: 'var(--fd)',
                        color: 'var(--c)',
                        textShadow: '0 0 40px rgba(0,204,255,0.4)',
                      }}
                    >
                      {faucetAmountFormatted}
                    </span>
                    <span className="text-xs font-bold tracking-[0.3em] text-white/50 uppercase">CHESS TOKENS</span>
                  </motion.div>
                </div>

                {/* Info Badge */}
                <div className="flex items-center gap-3 py-3 px-5 rounded-2xl border border-white/5 bg-black/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--c)] shrink-0" />
                  <span className="text-[10px] font-medium text-white/40 leading-relaxed">
                    The faucet dispenses <span className="text-white/70 font-bold">{faucetAmountFormatted} CHESS</span> per claim.
                    Cooldown resets approximately every <span className="text-white/70 font-bold">24 hours</span>.
                  </span>
                </div>
              </div>

              {/* Separator */}
              <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              {/* Wallet Status & Claim Button */}
              {!isConnected ? (
                <div className="flex flex-col items-center gap-5 py-8">
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
                    <span className="text-2xl">🔒</span>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-white/60 uppercase tracking-widest mb-1">Wallet Required</p>
                    <p className="text-xs text-white/30">Connect your Celo wallet to claim tokens</p>
                  </div>
                  <GlowButton variant="brand" size="lg" parallelogram onClick={connectWallet}>
                    CONNECT WALLET
                  </GlowButton>
                </div>
              ) : isClaiming ? (
                <LoadingState message="BROADCASTING TRANSACTION" />
              ) : (
                <div className="flex flex-col items-center gap-6 py-4">
                  {/* Address Chip */}
                  <div className="flex items-center gap-2 bg-black/30 py-2 px-5 rounded-full border border-white/10">
                    <div className="w-2 h-2 rounded-full bg-[#35ee66] animate-pulse" />
                    <span className="text-[10px] font-bold tracking-[0.15em] text-white/60 font-mono">
                      {playerAddress?.slice(0, 8)}...{playerAddress?.slice(-6)}
                    </span>
                  </div>

                  <GlowButton
                    variant="brand"
                    size="lg"
                    parallelogram
                    onClick={handleClaim}
                    className="min-w-[280px]"
                  >
                    CLAIM {faucetAmountFormatted} CHESS
                  </GlowButton>

                  <span className="text-[9px] font-bold tracking-[0.2em] text-white/25 uppercase">
                    One claim per day • Celo Network
                  </span>
                </div>
              )}
            </div>
          </motion.div>

          {/* ── INFO CARDS ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { piece: 'knight' as const, color: '#00ccff', title: 'INSTANT', desc: 'Tokens arrive in your wallet within seconds of confirmation.' },
              { piece: 'pawn' as const, color: '#a064ff', title: 'DAILY RESET', desc: 'The cooldown resets every ~24 hours. Come back daily.' },
              { piece: 'king' as const, color: '#ffb400', title: 'PLAY READY', desc: 'Use claimed tokens to create matches and wager in games.' },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="rounded-2xl border border-white/5 bg-slate-900/40 backdrop-blur-sm p-5 flex flex-col gap-3"
              >
                <div className="h-12 flex items-center -ml-2">
                  <PieceView type={card.piece} color={card.color} className="w-12 h-12" />
                </div>
                <span className="text-[10px] font-black tracking-[0.25em] text-[var(--c)] uppercase" style={{ fontFamily: 'var(--fd)' }}>
                  {card.title}
                </span>
                <p className="text-[11px] text-white/40 leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </div>

        </div>
      </div>

      {/* ── RESULT MODAL ── */}
      <FaucetResultModal
        type={resultType}
        onClose={() => {
          setResultType(null)
          setTxHash('')
          setErrorMessage('')
          setCooldownRemaining('')
        }}
        txHash={txHash}
        amount={faucetAmountFormatted}
        errorMessage={errorMessage}
        cooldownRemaining={cooldownRemaining}
        chain="celo"
      />
    </main>
  )
}
