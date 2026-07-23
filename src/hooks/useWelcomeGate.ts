import { create } from 'zustand'

// First-timer welcome — shown once per device. A shared store (not local state)
// so the gate, the app layout, and useProfileLink all agree on one dismissed
// flag: the identity-link signature must not fire until the welcome is gone.
export const WELCOME_SEEN_KEY = 'pc-welcome-seen'

function getStoredValue(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function hasWelcomeBeenDismissed(): boolean {
  if (typeof window === 'undefined') return true // SSR: never render the gate server-side
  return !!getStoredValue(WELCOME_SEEN_KEY)
}

interface WelcomeState {
  dismissed: boolean
  dismiss: () => void
}

export const useWelcomeGate = create<WelcomeState>((set) => ({
  dismissed: hasWelcomeBeenDismissed(),
  dismiss: () => {
    try { localStorage.setItem(WELCOME_SEEN_KEY, '1') } catch { /* private mode / quota */ }
    set({ dismissed: true })
  },
}))