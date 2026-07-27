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

function validateProfile(profile: ChessProfile): ProfileCheckResult {
  if (profile.username.length === 0) {
    return { available: false, reason: 'Username cannot be empty' };
  }
  if (profile.displayName.length > 30) {
    return { available: false, reason: 'Display name cannot be more than 30 characters' };
  }
  if (profile.bio.length > 120) {
    return { available: false, reason: 'Bio cannot be more than 120 characters' };
  }
  return { available: true };
}
