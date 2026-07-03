export interface ChessProfile {
  address: string           // 0x... lowercase
  username: string          // "jadon" — displayed as "jadon.chess"
  displayName: string       // freeform, max 30 chars
  bio: string               // max 120 chars
  og: boolean               // first 100 profiles, locked forever
  createdAt: number         // unix ms
  updatedAt: number         // unix ms
  usernameChangedAt: number // unix ms — 30-day username change lock
}

export interface ProfileCheckResult {
  available: boolean
  reason?: string
}

export interface BatchProfileResult {
  profiles: Record<string, ChessProfile | null>
}

export function validateChessProfile(profile: ChessProfile): boolean {
  if (!profile.address || !profile.username || !profile.displayName || !profile.bio) {
    return false;
  }
  if (profile.displayName.length > 30 || profile.bio.length > 120) {
    return false;
  }
  return true;
}
