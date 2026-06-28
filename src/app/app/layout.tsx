'use client'
import { usePathname } from 'next/navigation'
import BottomNav from '@/components/ui/BottomNav'
import SideNav from '@/components/ui/SideNav'
import { Navbar } from '@/components/landing/Hero'
import { useProfileLink } from '@/hooks/useProfileLink'

// Shared chrome for every /app/* route.
// • Desktop (≥769px): the fixed SideNav rail replaces the top nav; content is
// offset by the rail width via `.pc-app-shell`.
// • Mobile (≤768px): the top Navbar + bottom nav own the chrome.
// On the game route the bottom nav is replaced by the in-screen action bar, and
// the mobile top Navbar is dropped (the board keeps its own header + back link).

const getNavigationComponents = (isGame: boolean) => {
  if (isGame) {
    return [
      <SideNav key="side-nav" />, 
      <div key="content" className={undefined}>{children}</div>
    ]
  } else {
    return [
      <SideNav key="side-nav" />, 
      <div key="mobile-chrome" className="pc-mobile-chrome">
        <Navbar />
      </div>,
      <div key="content" className="pc-app-scroll">{children}</div>,
      <BottomNav key="bottom-nav" />
    ]
  }
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isGame = pathname.startsWith('/app/game')
  // Self-heal the EOA ↔ smart-account name split for Privy users (one-time, silent).
  useProfileLink()
  return (
    <div className="pc-app-shell">
      {getNavigationComponents(isGame)}
    </div>
  )
}