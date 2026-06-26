import Link from 'next/link'
import StatBadge from '@/components/ui/StatBadge'
import GlowButton from '@/components/ui/GlowButton'
import ChessName from '@/components/ui/ChessName'
import ChessAvatar from '@/components/ui/ChessAvatar'
import { type GameData, ZERO } from './types'

interface GameHeaderProps {
  isBotGame: boolean
  gameId: number
  gameData: GameData | null
  wagerFormatted: string
  statusLabel: string
  myColor: 'white' | 'black' | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- profile map shape lives in useBatchProfiles
  gameProfileMap: Record<string, any>
}

export default function GameHeader({ isBotGame, gameId, gameData, wagerFormatted, statusLabel, myColor, gameProfileMap }: GameHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-6 mb-3 md:mb-12">
      <div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter" style={{ fontFamily: 'var(--fd)' }}>
          {isBotGame ? <>AI <span style={{ color: 'var(--c)' }}>Training</span></> : <>Match <span style={{ color: 'var(--c)' }}>#{gameId}</span></>}
        </h1>
        {isBotGame ? (
          <div className="flex gap-4 mt-2 md:mt-4">
            <StatBadge label="MODE" value="SINGLE PLAYER" accent />
            <StatBadge label="OPPONENT" value="SYSTEM BOT" />
          </div>
        ) : gameData && (
          <>
            <div className="flex flex-wrap gap-3 md:gap-4 mt-2 md:mt-4">
              <StatBadge label="WAGER" value={`${wagerFormatted} CHESS`} accent />
              <StatBadge label="STATUS" value={statusLabel} />
              {myColor && <StatBadge label="YOU PLAY" value={myColor.toUpperCase()} />}
            </div>
            <div className='flex items-center gap-3 mt-2 md:mt-4'>
              <div className="flex items-center gap-2">
                <ChessAvatar address={gameData.white} size={24} />
                <ChessName
                  address={gameData.white}
                  profile={gameProfileMap[gameData.white.toLowerCase()]}
                  short
                  className="text-xs font-bold text-white/80"
                />
              </div>
              <span className="text-[var(--t3)] text-xs font-black">vs</span>
              {gameData.black && gameData.black !== ZERO ? (
                <div className="flex items-center gap-2">
                  <ChessAvatar address={gameData.black} size={24} />
                  <ChessName
                    address={gameData.black}
                    profile={gameProfileMap[gameData.black.toLowerCase()]}
                    short
                    className="text-xs font-bold text-white/80"
                  />
                </div>
              ) : (
                <span className="text-xs text-[var(--t3)] italic">waiting…</span>
              )}
            </div>
          </>
        )}
      </div>
      {/* Desktop only — on mobile the fixed game action bar provides Quit/New Game */}
      <Link href="/app/lobby" className="hidden md:block">
        <GlowButton variant="ghost" size="sm" parallelogram>← BACK TO LOBBY</GlowButton>
      </Link>
    </div>
  )
}
