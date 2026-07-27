'use client'

import { usePathname } from 'next/navigation'
import BottomNav from '@/components/ui/BottomNav'
import SideNav from '@/components/ui/SideNav'
import { Navbar } from '@/components/landing/Hero'
import StreakCelebration from '@/components/ui/StreakCelebration'
import WelcomeGate from '@/components/ui/WelcomeGate'
import { useProfileLink } from '@/hooks/useProfileLink'
import { useWelcomeGate } from '@/hooks/useWelcomeGate'
import { useWallet } from '@/components/wallet-provider'

// Shared chrome for every /app/* route.
//  • Desktop (≥769px): the fixed SideNav rail replaces the top nav; content is
//    offset by the rail width via `.pc-app-shell`.
//  • Mobile (≤768px): the top Navbar + bottom nav own the chrome.
// On the game route the bottom nav is replaced by the in-screen action bar, and
// the mobile top Navbar is dropped (the board keeps its own header + back link).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isGame = pathname.startsWith('/app/game')

  // Self-heal the EOA ↔ smart-account name split for Privy users (one-time, silent).
  useProfileLink()

  // First-timer welcome. Show it the moment the user is connected — during the
  // several-second window while the smart account still resolves — so it covers
  // the "setting up wallet" screen and any wallet prompts rather than trailing
  // them. The identity-link signature in useProfileLink waits for it to dismiss.
  const { isConnected } = useWallet()
  const { dismissed, dismiss } = useWelcomeGate()

  return (
    <div className="pc-app-shell">
      <SideNav />
      {!isGame && (
        <div className="pc-mobile-chrome">
          <Navbar />
        </div>
      )}
      <div className={isGame ? undefined : 'pc-app-scroll'}>{children}</div>
      {!isGame && <BottomNav />}
      <StreakCelebration />
      <WelcomeGate open={isConnected && !dismissed} onDone={dismiss} />
    </div>
  )
}
