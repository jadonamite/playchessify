# Playchessify — Handover Document

**Last updated:** 2026-05-24 | **Head commit:** `cb9ab47`
**Live on:** Celo Mainnet | **Repo:** `github.com/jadonamite/playchessify`

Celo-only Next.js frontend for the on-chain ChessGame + ChessToken contracts. All features below are **shipped and passing build**.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16.2.1, App Router, TypeScript |
| Chain | Celo Mainnet (`chainId: 42220`) |
| Wallet/Auth | Privy — embedded wallets + social login (`@privy-io/react-auth` + `@privy-io/wagmi`) |
| Chain state | Wagmi + Viem (`publicClient.multicall` for batch reads) |
| Server state | `@tanstack/react-query` (5-min staleTime throughout) |
| Client state | Zustand (`useSettingsStore`, `useToastStore`) |
| Profile storage | Upstash Redis — **off-chain only, no contract** |
| Move relay | Upstash Redis pub/sub (`useGameMoves`) |
| Audio | Web Audio API — fully synthesised, zero external files |
| Styling | Tailwind CSS + CSS variables (design tokens in `globals.css`) |
| 3D/Canvas | `@react-three/fiber` + `@react-three/drei` (lobby/history backgrounds) |
| Chess logic | `chess.js` |
| Board UI | `react-chessboard` (dynamic import, SSR disabled) |

---

## Contract Addresses (Celo Mainnet)

```
ChessToken: 0xE370aad742dF8DC8Ae9c0F0b9f265334D39e2197
ChessGame:  0xf85f00D39A84b5180390548Ea9f76B0458607E78
```

TOKEN_DECIMALS = 6 | FAUCET = 1000 CHESS | FAUCET_COOLDOWN = 144 blocks (~1 day)

### Contract ABI — key functions

```
ChessToken:  balanceOf, allowance, approve, faucetClaim, decimals
ChessGame:   createGame(wager), joinGame(gameId), submitMove(gameId),
             resign(gameId), reportWin(gameId), getGame(gameId),
             playerStats(address), gameNonce
```

### `getGame(gameId)` struct fields

```
white, black              address
wager                     uint256
status                    uint8 — 0=Waiting, 1=Active, 2=Finished, 3=Cancelled, 4=Draw
result                    uint8 — 0=None, 1=WhiteWins, 2=BlackWins, 3=DrawResult
turn                      address
moveCount                 uint256
createdAt, lastMoveBlock  uint256
drawProposer              address
```

### `playerStats(address)` returns

```
wins, losses, draws, rating, gamesPlayed   all uint256
```

---

## App Routes

| Route | Component | Notes |
|---|---|---|
| `/` | `Hero.tsx` (landing page) | 3D background, scroll sections |
| `/app` | `/app/page.tsx` | Guard: redirect to lobby if connected |
| `/app/lobby` | `LobbyContent.tsx` | Open games list, create/join wager flow |
| `/app/game/[id]` | `GameClient.tsx` | Full game UI |
| `/app/history` | `HistoryContent.tsx` | On-chain match history for connected wallet |
| `/app/leaderboard` | `LeaderboardContent.tsx` | ELO leaderboard via `playerStats` multicall |
| `/app/profile/[identifier]` | Profile page | Accepts `0x` address or `.chess` username |
| `/app/settings` | Settings page | Sound, board theme, profile edit |
| `/app/faucet` | Faucet page | Claim 1000 CHESS |

---

## Feature Inventory

### 1. Wallet & Auth
- Privy embedded wallets + social login (`loginMethods`: google, twitter, discord, github, email, wallet)
- Embedded wallet auto-created for users without one (`createOnLogin: 'users-without-wallets'`)
- `useWallet()` wraps `useAccount` + `useConnect` + `useDisconnect`
- Auto-redirect `/app/lobby` on connect; guard back to `/` if disconnected
- Navbar wallet pill: ChessAvatar + ChessName → `/app/profile/{address}` + separate disconnect button
- Mobile drawer: avatar + name link + DISCONNECT text button

### 2. Toast System
- Zustand store: `src/hooks/useToastStore.ts`
- Animated component: `src/components/ui/CenterToast.tsx`
- Types: `success | error | info | invalid | check | checkmate | draw`
- Globally mounted in `src/app/providers.tsx`

### 3. Game Lobby & Wager Flow
- Open challenges listed via `useLobby` hook (multicall scan)
- Balance check before create/join; wager presets disabled on insufficient balance
- Sequential approve → createGame with Step 1/2 UI; 1500ms gap between approve confirm and createGame to prevent nonce drift
- Join by match ID input
- Challenger row: `ChessAvatar` + `ChessName asLink` (clicking name → profile)
- Onboarding banner: shown to connected wallets with no `.chess` profile — opens `ClaimModal` inline
- Ambient lofi track starts on mount (respects `soundEnabled` setting)

### 4. Chess Game (GameClient)
- `react-chessboard` (dynamic import, SSR disabled)
- PvP via move relay: `useGameMoves` hook reads/writes to `/api/games/celo/[id]/moves` (Upstash Redis)
- Bot mode: Stockfish-lite minimax in `src/lib/chess-engine.ts` (`getBestMove`)
- Board orientation: white plays from bottom, black flips automatically
- **Legal moves highlight** on piece selection:
  - Empty destination squares: `radial-gradient` green dot (30% fill)
  - Capture squares: `inset box-shadow` green ring, 3px
  - Selected piece square: `rgba(0,204,255,0.35)` cyan tint
- **GET HINT**: amber squares show engine's suggested move (distinct from legal moves green)
- Resign flow with confirmation
- Opponent timeout: 5-min countdown, auto-trigger `reportWin`
- Promotion modal (queen/rook/bishop/knight)
- Win detection: checkmate, resign, timeout, draw
- Game header: `ChessAvatar` + `ChessName` for both white and black players
- Board colors driven by `useSettingsStore().boardTheme` → `BOARD_THEMES[theme].dark/light`
- Game track starts when `contractActive || isBotGame`; landing track otherwise

### 5. Match History
- Route: `/app/history`
- `useHistory` hook: scans all games 1..`gameNonce` via multicall, filters for connected wallet
- `HistoryItem.result` computed from `GameResult` enum:
  - `status=0` → `waiting`
  - `status=4 || result=3` → `draw`
  - `status=2 && result=1` → white wins (role determines `win`/`loss`)
  - `status=2 && result=2` → black wins (role determines `win`/`loss`)
- Result column: colored badge — green WIN / red LOSS / slate DRAW / cyan ACTIVE / gray otherwise
- Opponent column: `ChessName` with `asLink` prop
- Match ID row is a `<button>` → `router.push('/app/game/{id}')`

### 6. Leaderboard
- `useLeaderboard` hook: multicall `playerStats` for all addresses seen in games
- Podium top-3: `ChessAvatar` + `ChessName asLink` + ELO crown/badge
- Rows 4+: `ChessAvatar` + `ChessName asLink`
- "YOUR POSITION" banner: shows connected wallet's rank, avatar, name
- Profiles resolved via `useBatchProfiles`

### 7. .chess Naming System

> **CRITICAL CONSTRAINT:** This is **intentionally off-chain Upstash Redis**. There is **no smart contract** for names. Do not build one without an explicit design session with Jadon covering: gas cost model, contract upgrade strategy, name transfer mechanics, migration of existing names, and whether UX friction is acceptable. This is a Phase 2 decision requiring explicit approval before any migration work begins.

#### Redis key schema
```
chess:profile:addr:{lowercase_address}   → JSON(ChessProfile)
chess:profile:name:{lowercase_username}  → {lowercase_address}
chess:profile:namelock:{address}         → {timestamp_ms}  (username change cooldown)
chess:profile:total                      → integer (count of claimed profiles)
chess:profile:recent                     → LIST of last 50 addresses
```

#### ChessProfile type (`src/types/profile.ts`)
```ts
{
  address: string           // 0x... lowercase
  username: string          // "jadon" — displayed as "jadon.chess"
  displayName: string       // freeform ≤30 chars
  bio: string               // freeform ≤120 chars
  og: boolean               // first 100 profiles, forever locked
  createdAt: number         // unix ms
  updatedAt: number         // unix ms
  usernameChangedAt: number // unix ms — 30-day change lock
}
```

#### API routes (`src/app/api/profile/`)
```
GET  /api/profile/[address]         → ChessProfile | 404
GET  /api/profile/name/[username]   → { profile: ChessProfile } | 404
GET  /api/profile/check/[username]  → { available: boolean, reason? }
POST /api/profile/claim             → { profile: ChessProfile } — create (sig required)
PATCH /api/profile/[address]        → { profile: ChessProfile } — update (sig required)
POST /api/profile/batch             → body: { addresses: string[] }
                                      response: Record<addr, ChessProfile|null>
GET  /api/profile/recent            → ChessProfile[] (last 10)
```

#### Signature / auth scheme
No sessions, no JWTs. Every mutating call requires `signature` + `timestamp` in the request body.
Server: `viem.verifyMessage(message, signature) === address` + timestamp within 5 minutes (replay protection).

Claim message:
```
Chessify Profile Claim

Username: {username}.chess
Address: {address}
Timestamp: {iso_timestamp}
```

Update message:
```
Chessify Profile Update

Address: {address}
Timestamp: {iso_timestamp}
```

#### Username rules
- Regex: `^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$` (3–20 chars)
- No leading/trailing hyphens
- Blocked: `admin, system, chessify, api, app, chess, king, queen, rook, bishop, knight, pawn, null, undefined, root, support`
- Username change cooldown: 30 days (enforced server-side via `usernameChangedAt`)
- First 100 profiles get `og: true` permanently

#### Components
| Component | Props | Behaviour |
|---|---|---|
| `<ChessName />` | `address, profile?, short?, badge?, asLink?, className?, style?` | Resolves `username.chess`; fallback `0x1234…abcd` while loading. `asLink` wraps in `<Link href="/app/profile/{address}">` |
| `<ChessAvatar />` | `address, size?` | Deterministic SVG from address bytes; chess piece type chosen by `byte[7] % 6` |
| `<ClaimModal />` | `open, address, onClose, onSuccess` | 2-step: username/form → sign → success |

#### Hooks
| Hook | Description |
|---|---|
| `useProfile(address)` | Per-address React Query, 5-min staleTime |
| `useCheckUsername(username)` | Debounced availability check |
| `useClaimProfile()` | Mutation: POST /api/profile/claim |
| `useUpdateProfile()` | Mutation: PATCH /api/profile/[address] |
| `useBatchProfiles(addresses[])` | Single MGET round-trip, 5-min cache. Used in leaderboard, lobby, history, game |
| `usePlayerHistory(address)` | Scans last 40 games for given address; parameterized (not connected-wallet-only) |

#### Integration points (all complete)
| Location | What renders |
|---|---|
| Leaderboard — podium + rows | `ChessAvatar` + `ChessName asLink` |
| History — opponent column | `ChessName asLink` |
| Lobby — challenger row | `ChessAvatar` + `ChessName asLink` |
| Game — match header | `ChessAvatar` + `ChessName` for white + black |
| Navbar — wallet pill | `ChessAvatar` + `ChessName` → `/app/profile/{address}` |
| Profile page | Full profile view |
| Settings | Inline profile edit |

#### Profile page (`/app/profile/[identifier]`)
- Resolves `identifier` as address (`0x`) or username (fetch `/api/profile/name/[username]`)
- Shows: 80px avatar, `username.chess`, OG ✦ badge, display name, bio, member since
- On-chain stats card: ELO, WIN%, WINS, LOSSES, DRAWS, PLAYED (via `playerStats`)
- Recent Games card: last 10 games from `usePlayerHistory` — WIN/LOSS/DRAW badge, opponent avatar + ChessName asLink, role, wager, VIEW button
- Own profile: EDIT inline (display name + bio, sign-to-save); SHARE PROFILE (copies URL)
- Not own: CHALLENGE (→ lobby) + SHARE PROFILE
- Address copy button at bottom
- Own unclaimed wallet: CLAIM .CHESS NAME button → ClaimModal

### 8. Settings (`/app/settings`)
- Sound toggle: `useSettingsStore().soundEnabled` — global, persisted to localStorage
  - Stops lobby ambient immediately on toggle off; restarts on toggle on
  - Game track also respects setting at startup
- Board themes: 4 options persisted to localStorage — applied in `GameClient`
  ```
  dark:     { dark: '#0f172a', light: '#1e293b' }  ← default
  forest:   { dark: '#1a3a2a', light: '#2d5a3d' }
  classic:  { dark: '#b58863', light: '#f0d9b5' }
  midnight: { dark: '#1a0a2e', light: '#2d1b54' }
  ```
  Mini 4×4 board preview per option; active state highlighted with cyan border
- Profile section:
  - Not connected → prompt to connect
  - Connected, no profile → CLAIM .CHESS NAME button
  - Connected, has profile → inline display name + bio edit with character counters, SAVE CHANGES (sign-to-save), VIEW FULL PROFILE link
  - Hydration fix: `useEffect` syncs edit fields when profile loads; `editDirty` guard prevents overwriting in-progress edits

### 9. Audio System (`src/lib/audio.ts`)
Singleton engine, zero external files. All sound is Web Audio API synthesis.

#### Tracks
| Track | BPM | Kit |
|---|---|---|
| Landing / lobby | 75 | Soft ghost snare on beats 2/6, hi-hats, Am7 pads, walking bass, vinyl crackle |
| Game | 85 | Full kick/snare/hihat with swing, ghost snare rolls (25% chance beats 3/7), pads, bass, vinyl |

#### Instrument functions
```
kick(ctx, dst, t, vel)          — sine sweep 140→40Hz + bandpass noise click
snare(ctx, dst, t, vel)         — tonal sine 220→90Hz + bandpass noise 3200Hz
hihat(ctx, dst, t, open, vel)   — highpass noise 6800Hz (open hat longer decay)
pad(ctx, dst, t, dur)           — Am7 chord (A2,C3,E3,G3) triangle osc → lowpass
bassNote(ctx, dst, t, freq, dur)— sawtooth → lowpass; 8-note Am walking bassline
vinylCrackle(ctx, dst, t)       — 18% probability random noise impulse
```

Swing: `SWING = 0.018s` added to all off-beats. Velocity jitter ±30% on every hit.

#### Exports
```ts
startAmbient(ctx)              // landing / lobby track (75 BPM)
startGameTrack(ctx)            // game track (85 BPM)
stopAmbient(_ctx?)             // fade + cleanup (works from either mode)
playMoveSound(ctx, isOpponent) // bandpass noise thud + sine sub (darker for opponent)
playMoveChime                  // alias for playMoveSound (backwards compat)
```

---

## Key File Map

```
src/
├── app/
│   ├── providers.tsx                      ← QueryClient + Privy + Wagmi + Toast mount
│   ├── app/
│   │   ├── lobby/page.tsx
│   │   ├── game/[id]/page.tsx
│   │   ├── history/page.tsx
│   │   ├── leaderboard/page.tsx
│   │   ├── profile/[identifier]/page.tsx  ← profile page (address or username)
│   │   ├── settings/page.tsx              ← settings page
│   │   └── faucet/page.tsx
│   └── api/
│       ├── profile/[address]/route.ts
│       ├── profile/batch/route.ts
│       ├── profile/check/[username]/route.ts
│       ├── profile/claim/route.ts
│       ├── profile/name/[username]/route.ts
│       ├── profile/recent/route.ts
│       └── games/[chain]/[id]/moves/route.ts
├── components/
│   ├── landing/Hero.tsx                   ← Navbar (exported separately) + landing
│   ├── lobby/
│   │   ├── LobbyContent.tsx               ← games list, create/join, ambient audio, onboarding
│   │   ├── HistoryContent.tsx             ← history with WIN/LOSS/DRAW badges
│   │   └── LeaderboardContent.tsx         ← ELO leaderboard with profiles
│   ├── game/GameClient.tsx                ← full game UI, board, moves, audio, profiles
│   └── ui/
│       ├── ChessName.tsx                  ← name/username display + asLink prop
│       ├── ChessAvatar.tsx                ← deterministic SVG avatar
│       ├── ClaimModal.tsx                 ← .chess name claim flow (2-step)
│       ├── GlowButton.tsx
│       ├── ClayCard.tsx
│       ├── CenterToast.tsx
│       ├── LoadingState.tsx
│       ├── ChessModels.tsx                ← Three.js chess piece 3D models
│       └── PromotionModal.tsx
├── hooks/
│   ├── useProfile.ts          ← useProfile, useCheckUsername, useClaimProfile, useUpdateProfile
│   ├── useBatchProfiles.ts    ← batch MGET, 5-min React Query cache
│   ├── usePlayerHistory.ts    ← per-address history scan (profile page)
│   ├── useHistory.ts          ← connected-wallet full history (history page)
│   ├── useSettingsStore.ts    ← Zustand persist: soundEnabled, boardTheme + BOARD_THEMES
│   ├── useToastStore.ts       ← Zustand: global toasts
│   ├── useCeloChess.ts        ← balance, allowance, approve, createGame, joinGame
│   ├── useGameMoves.ts        ← move relay read/write/poll
│   ├── useLobby.ts            ← open games multicall
│   └── useLeaderboard.ts      ← ELO leaderboard multicall
├── lib/
│   ├── audio.ts               ← lofi synthesiser (all tracks + move sounds)
│   ├── chess-engine.ts        ← minimax bot + getBestMove hint
│   ├── profile-store.ts       ← Redis CRUD (server-side only)
│   └── avatar.ts              ← deterministic SVG from address bytes
├── config/
│   ├── contracts.ts           ← addresses + TOKEN_DECIMALS + FAUCET constants
│   └── abis.ts                ← ChessToken + ChessGame ABIs
└── types/
    └── profile.ts             ← ChessProfile, ProfileCheckResult, BatchProfileResult
```

---

## Environment Variables

```bash
NEXT_PUBLIC_PRIVY_APP_ID             # Privy app ID (client) — required for wallet/auth
NEXT_PUBLIC_CELO_TOKEN               # optional — overrides hardcoded token address
NEXT_PUBLIC_CELO_GAME                # optional — overrides hardcoded game address
UPSTASH_REDIS_REST_URL               # profile store + move relay
UPSTASH_REDIS_REST_TOKEN
```

---

## Non-Obvious Implementation Details

### Nonce drift fix
`useCeloChess`: 1500ms `sleep` between `approve` confirmation and `createGame`. Prevents wallet reusing the same nonce on Celo when two txs fire back-to-back.

### Batch profile resolution
All address→name lookups go through `useBatchProfiles(addresses[])` → single `POST /api/profile/batch` → Redis `MGET`. Keeps round-trips to 1 per component regardless of list size.

### Win/loss from contract
`GameResult` enum: `None=0, WhiteWins=1, BlackWins=2, DrawResult=3`. No `loser` address field exists on the contract. Both `useHistory` and `usePlayerHistory` derive `win|loss|draw` from `result` uint8 + the player's `role` (white/black). Status `4` or `result=3` both map to draw.

### Legal moves highlight
`chess.js game.moves({ square, verbose: true })` returns `{ to, flags }` per legal move. Flag `'c'` (capture) or `'e'` (en passant) gets a ring (`inset box-shadow`); all others get the radial dot. Both via `squareStyles` prop on `react-chessboard`.

### Settings hydration
`useSettingsStore` uses Zustand `persist` — SSR starts with defaults, hydrates client-side. Settings page guards edit fields with `editDirty` flag: `useEffect` syncs fields from profile only when `!editDirty`, preventing overwrites of in-progress user input.

### `asLink` in ChessName
Wraps rendered span in `<Link href="/app/profile/{address}">` with `color: inherit; textDecoration: none`. Safe to drop in anywhere — inherits surrounding text color automatically.

### OG badge
`chess:profile:total` counter incremented atomically on each claim. If count < 100 at claim time, `og: true` is set and never modifiable after. Rendered as ✦ in profile, settings, and leaderboard.

### Audio singleton
`audio.ts` maintains a single `EngineState` (`E`) across the module lifetime. `stopAmbient` fades master gain to 0 over 1.5s then destroys the AudioContext. `startAmbient`/`startGameTrack` both call `stopAmbient` first to prevent double-playing. The lobby uses a `useRef<AudioContext>` to persist the context instance across re-renders and clean up on unmount.

---

## What's Not Built Yet

| Feature | Notes |
|---|---|
| Leaderboard pagination | Scans all games via multicall — will get slow as gameNonce grows. Needs Redis sorted set or cursor. |
| Game replay viewer | Move log exists in relay store; no UI to step through historical moves. |
| Draw offer UI | Contract has `drawProposer` field; propose/accept flow not wired in GameClient. |
| Profile picture upload | Avatar is deterministic SVG; no custom image support. |
| Player search | No global username search; only direct URL resolution. |
| Recent profiles feed | `/api/profile/recent` exists but no page surfaces it. |
| Opponent join notification | No push/in-app notification when opponent joins your open game. |
