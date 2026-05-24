# Playchessify — Handover Document

Celo-only frontend for the ChessGame + ChessToken contracts. All features below are **live and shipped**.

---

## Architecture

- **Framework**: Next.js 16.2.1, App Router, TypeScript
- **Chain**: Celo mainnet only (ChessGame.sol + ChessToken.sol)
- **Auth**: Reown AppKit + Web3Auth social login
- **State**: Wagmi + React Query + Zustand
- **Profile storage**: Upstash Redis (off-chain, no smart contract)
- **Audio**: Web Audio API — synthesised, no external files

---

## Completed Features

### 1. Wallet & Auth ✅
- Reown AppKit modal + Web3Auth social login (`initModal` fix applied)
- `useWallet()` context wraps `useAccount` + `useConnect` + `useDisconnect`
- Auto-redirect to `/app/lobby` on connect; reverse guard back to `/` if disconnected

### 2. Toast System ✅
- Zustand store: `src/hooks/useToastStore.ts`
- Animated component: `src/components/ui/CenterToast.tsx`
- Types: `success`, `error`, `info`, `invalid`, `check`, `checkmate`, `draw`
- Mounted globally in `src/app/providers.tsx`

### 3. Game Lobby & Wager Flow ✅
- Balance check before create/join; wager presets disabled on insufficient balance
- Sequential approve → create flow with Step 1/2 UI
- 1500ms sleep between approve confirm and createGame to prevent nonce drift
- Join by match ID input in lobby

### 4. Chess Game (GameClient) ✅
- `react-chessboard` board (dynamic import, SSR-disabled)
- PvP via move relay (Upstash Redis pub/sub) — `useGameMoves` hook
- Bot mode (Stockfish-lite via `getBestMove` in `src/lib/chess-engine.ts`)
- Legal moves highlight: green dots on all destination squares on piece selection
  - Empty squares: radial-gradient dot
  - Capture squares: green ring (inset box-shadow)
- GET HINT button: amber squares show engine's suggested move (distinct from legal moves)
- Resign flow; opponent timeout (5-min countdown)
- Promotion modal
- Win detection: checkmate, resign, timeout, draw

### 5. Settings (Persisted) ✅
- Route: `/app/settings`
- Zustand store: `src/hooks/useSettingsStore.ts` — persisted to `localStorage`
- **Sound toggle** — controls lobby ambient AND game track globally
- **Board themes**: Dark (default), Forest, Classic, Midnight — live board preview per selection
- **Profile section**: inline display name + bio edit with sign-to-save; ClaimModal shortcut

### 6. Audio System ✅
- `src/lib/audio.ts` — full Web Audio API lofi synthesiser
- **Landing/lobby track (75 BPM)**: ghost snare, hi-hats, Am7 pads, walking bass, vinyl crackle
- **Game track (85 BPM)**: kick/snare/hihat with swing, ghost snare rolls, pads, bass, vinyl
- **Piece hit sound**: bandpass noise thud + sine sub sweep (darker for opponent)
- Swing timing (SWING constant pushes off-beats ~18ms), velocity jitter ±30%, vinyl crackle ~18% chance per beat
- Lobby ambient starts/stops with `soundEnabled` setting
- Game track starts on `contractActive || isBotGame`; stops on game end or unmount

### 7. .chess Naming System ✅
**Off-chain, Upstash Redis. No smart contract. See constraint note below.**

#### Redis schema
```
chess:profile:addr:{address}      → JSON(ChessProfile)
chess:profile:name:{username}     → {address}
chess:profile:namelock:{address}  → {timestamp_ms}
chess:profile:total               → {integer}
chess:profile:recent              → LIST (last 50 addresses)
```

#### API routes
```
GET  /api/profile/[address]           → ChessProfile | 404
GET  /api/profile/name/[username]     → ChessProfile | 404
GET  /api/profile/check/[username]    → { available, reason? }
POST /api/profile/claim               → create (signature required)
PATCH /api/profile/[address]          → update (signature required)
POST /api/profile/batch               → { addresses[] } → Record<addr, profile|null>
GET  /api/profile/recent              → ChessProfile[] (last 10)
```

#### Signature scheme
Timestamp embedded in signed message, server rejects if >5 min old (replay protection).
`viem.verifyMessage` — no sessions, no JWTs.

Claim message:
```
Chessify Profile Claim

Username: {username}.chess
Address: {address}
Timestamp: {iso}
```

#### Username rules
- Regex: `^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$`
- 3–20 chars, no leading/trailing hyphens
- Blocked: admin, system, chessify, api, app, chess, king, queen, etc.
- Change cooldown: 30 days

#### OG badge
First 100 profiles get `og: true` (locked forever). Shown as ✦ next to name.

#### Components
- `<ChessName address props />` — resolves to `username.chess` or truncated `0x`, fallback while loading
  - Props: `badge`, `short`, `asLink` (wraps in `<Link /app/profile/{address}>`)
- `<ChessAvatar address />` — deterministic SVG from address bytes, chess piece selected by byte 7
- `useBatchProfiles(addresses)` — single Redis MGET round-trip, 5-min React Query cache
- `useProfile(address)` — per-address React Query, 5-min cache

#### Integration points (all done)
| Location | Display |
|---|---|
| Leaderboard (podium + rows) | ChessName + ChessAvatar, clickable → profile |
| History (opponent column) | ChessName, clickable → profile |
| Lobby (challenger row) | ChessName + ChessAvatar, clickable → profile |
| Game header (white/black) | ChessName + ChessAvatar |
| Navbar | ChessAvatar + ChessName → `/app/profile/{address}` |

#### Profile page
- Route: `/app/profile/[identifier]` — accepts `0x` address or username
- Shows: avatar (80px), username.chess, OG badge, display name, bio, member since
- On-chain stats: ELO, W/L/D/%, games played (via `playerStats` contract read)
- Own profile: edit display name + bio inline (sign-to-save)
- Not own: CHALLENGE (→ lobby) + SHARE PROFILE (copies URL to clipboard)
- Address copy button

#### Onboarding
- Lobby banner appears when connected wallet has no profile
- Opens ClaimModal inline — 3 steps: username → display name/bio → sign & claim
- ClaimModal also accessible from Settings profile section

---

## ⚠ Critical Constraint — No On-Chain Migration Without Discussion

The `.chess` naming system is intentionally **off-chain Upstash Redis**. There is no smart contract for names. Do not build one without an explicit design session with Jadon covering: gas cost model, contract upgrade strategy, name transfer mechanics, migration of existing names, and whether UX friction is acceptable. This is Phase 2 and requires explicit approval.

---

## Key Files

| File | Purpose |
|---|---|
| `src/lib/audio.ts` | Lofi synthesiser — landing + game tracks + piece hit |
| `src/lib/chess-engine.ts` | Minimax bot + hint move |
| `src/lib/profile-store.ts` | Redis CRUD for profiles |
| `src/lib/avatar.ts` | Deterministic SVG avatar from address |
| `src/hooks/useSettingsStore.ts` | Persisted settings (Zustand + localStorage) |
| `src/hooks/useBatchProfiles.ts` | Batch profile fetch (MGET) |
| `src/hooks/useProfile.ts` | Per-address profile + claim + update mutations |
| `src/components/ui/ChessName.tsx` | Name display component |
| `src/components/ui/ChessAvatar.tsx` | SVG avatar wrapper |
| `src/components/ui/ClaimModal.tsx` | Claim .chess name flow |
| `src/components/game/GameClient.tsx` | Full game UI + legal moves + sound |
| `src/components/lobby/LobbyContent.tsx` | Lobby + ambient audio + onboarding banner |
| `src/components/landing/Hero.tsx` | Navbar with profile pill |
| `src/app/app/profile/[identifier]/page.tsx` | Profile page |
| `src/app/app/settings/page.tsx` | Settings page |
| `src/app/api/profile/` | All profile API routes |

---

## Environment Variables Required

```
NEXT_PUBLIC_REOWN_PROJECT_ID
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID    (optional — has fallback)
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```
