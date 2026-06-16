import BottomNav from '@/components/ui/BottomNav'

// Shared layout for every /app/* route. Mounts the mobile bottom nav exactly
// once and adds bottom clearance (via .pc-app-scroll) so the fixed nav never
// covers content. Bottom nav is hidden ≥768px (see globals.css .pc-bottom-nav).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pc-app-scroll">{children}</div>
      <BottomNav />
    </>
  )
}
