'use client'

import { usePathname } from 'next/navigation'
import BottomNav from '@/components/ui/BottomNav'

// Shared layout for every /app/* route. Mounts the mobile bottom nav once and
// adds bottom clearance so the fixed nav never covers content. On the game route
// the nav is replaced by the in-screen game action bar, so we drop both the nav
// and the bottom padding (the game bar provides its own clearance).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isGame = pathname.startsWith('/app/game')

  return (
    <>
      <div className={isGame ? undefined : 'pc-app-scroll'}>{children}</div>
      {!isGame && <BottomNav />}
    </>
  )
}
