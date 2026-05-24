# Handover: Reown & Web3Auth Social Login Integration & Core Lobby Fixes

This document outlines the root causes of the failures in social logins (Reown/Web3Auth), the steps taken to resolve them, and the status of all tracked tasks.

## The Problems Identified & Resolved

### 1. Web3Auth Custom Connector Initialization Bug (`init` vs `initModal`)
* **Problem**: In `src/lib/web3auth-connector.ts`, the custom connector was calling `instance.init()` inside its `setup` and `isAuthorized` methods.
* **Details**: Because the app imports `Web3Auth` from `@web3auth/modal` (the plug-and-play UI modal SDK), it is required to call `instance.initModal()` instead of `instance.init()`. Using the generic `init()` method failed to set up or prepare the modal UI, making subsequent calls to `instance.connect()` fail silently.
* **Resolution**: Updated `src/lib/web3auth-connector.ts` to call `instance.initModal()`. ✅

### 2. Missing Environment Variables (`NEXT_PUBLIC_WEB3AUTH_CLIENT_ID`)
* **Problem**: The Web3Auth client initialization requires a valid `clientId`. In the local configuration, `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID` was completely missing from the `.env` file, causing `process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!` to evaluate to `undefined` and throw initialization crashes.
* **Resolution**: Added a robust fallback mechanism in `src/config/web3auth.ts`. ✅

### 3. Reown Native Email/Socials Were Disabled
* **Problem**: The built-in Reown AppKit social/email features (which run directly inside the Reown modal and do not depend on the Web3Auth client config) were explicitly set to `email: false` and `socials: []` in `src/config/reown.ts`.
* **Resolution**: Enabled native socials in `src/config/reown.ts`. ✅

---

## Completed Tasks

### 1. Automatic Redirect to Lobby ✅
* **Implementation**: `src/components/landing/Hero.tsx` — `useEffect` watches `isConnected` from `useWallet()` and calls `router.push('/app/lobby')` immediately on connect.
* **Reverse guard**: `src/components/lobby/LobbyContent.tsx` redirects back to `/` after 3 seconds if the user is not connected when the lobby loads.

### 2. Centralized Center-Middle Toast System ✅
* **Implementation**: Zustand store in `src/hooks/useToastStore.ts` + animated component in `src/components/ui/CenterToast.tsx` (Framer Motion).
* **Toast types**: `success`, `error`, `info`, `invalid`, `check`, `checkmate`, `draw` — each with distinct color, label, icon, and position (`center` or `bottom`).
* **Mounted globally** in `src/app/providers.tsx` so all pages share a single instance.

### 3. CHESS Token Balance Check ✅
* **Implementation**: `src/hooks/useCeloChess.ts` — both `createGame` and `joinGame` read `balanceOf` on-chain before any transaction. If `balance < amount`, an error toast fires and the function throws.
* **UI layer**: In `LobbyContent.tsx` create modal — wager preset buttons are visually disabled when the user's balance is insufficient, an inline warning with a faucet redirect link is shown, and the "INITIALIZE GAME" button is disabled.

### 4. Select Wager Modal UI ✅
* **Implementation**: `src/components/lobby/LobbyContent.tsx` create-match modal.
* **Features**: 6 preset wager amounts (50 / 100 / 250 / 500 / 1000 / 2500 CHESS), live balance display with loading spinner, per-preset disabled + dimmed state when balance is insufficient, active selection highlighted with cyan glow, inline faucet redirect on low balance.

### 5. Multi-Step Confirmation Modal (Approve + Spend) + Sticking Bug Fix ✅
* **Sticking bug fix**: `src/hooks/useCeloChess.ts` — after the `approve` tx is confirmed via `waitForTransactionReceipt`, a 1500ms delay (`sleep(1500)`) prevents wallet provider nonce out-of-sync from stalling the subsequent `createGame` tx. Both `createGame` and `joinGame` follow the same sequential pattern.
* **UI confirmation state**: While `isPending`, the create-match modal swaps to a full loading view showing a spinning lock icon and the label "Step 1: Approve Limit → Step 2: Initialize Game", replacing the wager selector until the transaction sequence completes or fails.

---

## Current State

All original handover tasks are resolved. The lobby is fully functional on Celo mainnet:
- Connect → auto-redirect to `/app/lobby`
- Balance displayed live in modal and sidebar
- Wager selection with balance-aware disabled states
- Sequential approve → create flow with wallet confirmation UI
- Toast system covers all error and success states globally

---

---

# Roadmap: Planned Features (Not Yet Built)

The following features have been fully designed and are ready to implement. They are documented here so any developer or session picking this up starts from a complete spec, not a blank page.

---

## Feature 1: Audio System

Three components, all using Web Audio API (no external files or CDN dependencies):

### 1a. Lofi Soundtrack — Two Tracks
**Landing track (75 BPM, ambient):** Soft closed hi-hats on 8th notes, Am7 chord pads (triangle oscillators, slow attack), subtle A2 bass root, vinyl crackle layer. No kick drum — calm, background presence.

**Game track (85 BPM, full lofi):**
- Kick: sine osc 150Hz→40Hz sweep, 80ms decay. Beats 1 + 3.
- Snare: white noise + sine layer, 120ms decay. Beats 2 + 4.
- Hi-hat closed: bandpass noise, 40ms. All 8th notes.
- Hi-hat open: 200ms decay on the "and" of 2 and 4.
- Bass: triangle, A2 on beat 1, E2 on beat 3.
- Chord pads: Am7→Cmaj7→Gmaj7→Fmaj7, 8-bar loop.
- Vinyl crackle: continuous low-amplitude noise.
- Velocity jitter: ±8% random amplitude per hit (removes mechanical feel).
- Timing humanisation: ±6ms random offset per drum event.

Crossfade (800ms) between tracks on page transition. Volume controlled via settings store.

### 1b. Piece-Hit Sound
Synthesised wood-on-board thud: white noise burst (30ms) through sharp bandpass at ~400Hz + sine sub at 80Hz for weight. Your move: brighter (500Hz), slightly louder. Opponent move: darker (300Hz), softer. Plays on every move including relay moves.

### 1c. Legal Moves Highlighter
When a piece is selected (`moveFrom` set), compute `game.moves({ square, verbose: true })` and highlight:
- **Empty destination**: small green dot — tight radial-gradient (28% fill, centre only).
- **Capture destination**: green ring around the occupying piece (transparent centre, outer ring).
Computed via `useMemo`. Clears on deselect, move, or game end. Replaces the current "GET HINT" button entirely.

**Status:** `src/lib/audio.ts` exists with basic oscillator drones. Needs full rewrite to the lofi drum engine described above. `GameClient.tsx` has sound toggle and hint-square wiring already in place — both need updating to the new design.

---

## Feature 2: Settings Page

**Route:** `/app/settings`

**Zustand store** (`src/stores/useSettingsStore.ts`), persisted to `localStorage`:
```ts
{
  soundtrackEnabled: boolean
  soundtrackVolume: number      // 0–1
  sfxEnabled: boolean
  sfxVolume: number             // 0–1
  boardOrientation: 'auto' | 'white' | 'black'
}
```

**Page sections:**
- **Sound** — individual toggles and volume sliders for soundtrack and SFX. Changes apply live (no reload).
- **Board** — orientation preference (auto = follows your colour in a match).
- **Profile** — view/edit `.chess` profile (claim form if no profile exists yet).

**Status:** Not yet built.

---

## Feature 3: `.chess` Naming System

> **IMPLEMENTATION CONSTRAINT — READ BEFORE TOUCHING ANYTHING:**
>
> This system is intentionally built **entirely off-chain using Upstash Redis** (the same Redis instance that powers the move relay). There is **no smart contract** involved. No Clarity contract. No Solidity contract. No on-chain transaction for name registration.
>
> The `.chess` suffix is a social/display convention — a username system with a branded suffix. It is not a decentralized naming protocol. It does not exist on any blockchain. Names are owned by the app, not by wallets in a cryptographic sense.
>
> **A future migration path to on-chain name ownership exists** (see section below), but it is explicitly Phase 2 and requires a full separate design discussion before a single line of contract code is written. Do not begin that migration under any circumstances without first having an explicit, detailed conversation with Jadon covering: gas cost model, contract upgrade strategy, name transfer mechanics, and whether the UX cost to users (gas for every claim) is acceptable. This decision touches every user of the protocol and cannot be undone.

### What it is

Every connected wallet can claim a unique username displayed as `username.chess` throughout the app. It replaces truncated `0xabc...def` addresses everywhere. Names are stored in Redis, verified by wallet signature, and resolved by API.

### Infrastructure

Uses the existing **Upstash Redis** instance (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` already in `.env`). Zero new infrastructure required.

### Redis Key Schema

```
chess:profile:addr:{address}          → JSON(ChessProfile)     primary record
chess:profile:name:{username}         → {address}              unique name index
chess:profile:namelock:{address}      → {timestamp_ms}         30-day username change lock
chess:profile:total                   → {integer}              total profile count (OG badge)
chess:profile:recent                  → LIST of addresses      last 50 created (LPUSH + LTRIM 50)
```

### Profile Data Model

```ts
interface ChessProfile {
  address: string           // 0x... lowercase, primary key
  username: string          // "jadon" — always displayed as "jadon.chess"
  displayName: string       // freeform, max 30 chars
  bio: string               // max 120 chars
  og: boolean               // true if among first 100 profiles — locked forever
  createdAt: number         // unix ms
  updatedAt: number         // unix ms
  usernameChangedAt: number // unix ms — used to enforce 30-day name change cooldown
}
```

Avatar is **not stored**. Generated deterministically from the wallet address as an inline SVG (gradient derived from address bytes + chess piece selected by address byte pattern). Same address → same avatar, always, with no storage or external dependency.

### API Routes

```
GET  /api/profile/[address]           → ChessProfile | 404
GET  /api/profile/name/[username]     → ChessProfile | 404
GET  /api/profile/check/[username]    → { available: boolean, reason?: string }
POST /api/profile/claim               → create profile (wallet signature required)
PATCH /api/profile/[address]          → update profile (wallet signature required)
POST /api/profile/batch               → { addresses: string[] } → Record<addr, ChessProfile|null>
GET  /api/profile/recent              → ChessProfile[] (last 10)
```

### Signature Scheme (No Auth Server, Replay-Proof)

Auth is wallet ownership. No sessions, no JWTs, no auth service.

The signed message embeds a timestamp. Server rejects anything older than 5 minutes — this prevents replay attacks without a nonce server.

**Claim message:**
```
Chessify Profile Claim

Username: jadon.chess
Address: 0xabc...
Timestamp: 2026-05-24T10:30:00.000Z
```

**Update message:**
```
Chessify Profile Update

Address: 0xabc...
Timestamp: 2026-05-24T10:30:00.000Z
```

Server verifies with `viem.verifyMessage({ address, message, signature })`.

### Atomic Name Reservation

```
Redis SETNX chess:profile:name:{username} {address}
```

Returns `0` if name is taken → reject 409. Returns `1` if name is free → proceed to write full profile. Two simultaneous claim requests for the same name: exactly one wins. No race conditions possible.

### Username Rules

```
Regex:   ^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$
Length:  3–20 characters
Rules:   No leading/trailing hyphens. No consecutive hyphens (--). Case insensitive (stored lowercase).
```

**Blocked names:**
```
admin, system, chessify, protocol, null, undefined, root, api, app, www,
support, help, test, dev, prod, chess, king, queen, rook, bishop, knight,
pawn, checkmate, moderator, official, staff, bot, relay, contract, deployer
```

**Field change policy:**

| Field | Cooldown |
|---|---|
| `username` | 30 days from `usernameChangedAt` |
| `displayName` | None |
| `bio` | None |

### Rate Limiting

Via `@upstash/ratelimit` (same Redis connection, no new setup):
- Profile claim: 2 per address per 24 hours
- Profile update: 5 per address per hour
- Batch lookup: 60 per IP per minute

### Batch Resolution (Critical for Leaderboard)

The leaderboard fetches 50–200 wallet addresses from on-chain. Resolving each individually would be 50–200 sequential API calls. The batch endpoint uses Redis `MGET` — a single round-trip regardless of address count.

Client-side: `useBatchProfiles(addresses: string[])` hook using React Query, 5-min stale time.

### `<ChessName />` Component

```tsx
<ChessName address="0x..." />           // → "jadon.chess"
<ChessName address="0x..." badge />     // → "jadon.chess ✦"  (OG badge)
<ChessName address="0x..." short />     // → "jadon"  (without .chess suffix)
```

- React Query per-address fetch, 5-min cache
- Instant fallback to `0xabc...def` while loading — no layout shift
- Used everywhere an address is displayed

### The 6 Integration Points

| File | Line / Location | Current | Target |
|---|---|---|---|
| `LeaderboardContent.tsx` | `fmt(entry.address)` (×2) | truncated address | `<ChessName address={entry.address} />` |
| `HistoryContent.tsx` | opponent display | raw address string | `<ChessName address={item.opponent} />` |
| `LobbyContent.tsx` | challenger row | `game.creator` string | `<ChessName address={game.creator} />` |
| `GameClient.tsx` | header / stat badges | `isCreator/isOpponent` raw addresses | `<ChessName address={gameData.white/black} />` |
| `Hero.tsx` / Navbar | connected wallet display | truncated `address` | `<ChessName address={address} />` |

### Profile Page

**Route:** `/app/profile/[identifier]`

`[identifier]` accepts both `0x...` (address) and `jadon` (username). Username routes resolve to address via API then render the same component. Canonical URL is always address-based.

**Layout:**
```
[ Avatar SVG ]   jadon.chess  [ ✦ OG ]
                 Display Name
                 Bio text
                 0xabc...def  [ copy ]

  ELO: 1420    W: 34    L: 12    D: 3    Games: 49

  [ Recent Games — last 10, from on-chain ]

  [ CHALLENGE ]   [ SHARE PROFILE ]   [ EDIT ]  ← edit only if own profile
```

Stats are read from the Celo contract (`playerStats`) on-chain — no separate stats database.

### OG Badge

`chess:profile:total` increments atomically on every new profile. If the value at claim time is ≤ 100, the profile is created with `og: true`, locked permanently. First 100 players get `✦` next to their name everywhere. Zero cost, drives early adoption.

### Onboarding Trigger

After wallet connect, a React Query fetch checks `GET /api/profile/{address}`. If no profile exists and the user hasn't dismissed:
- Sticky banner at bottom of lobby: `"You don't have a .chess identity — claim yours"`
- `[CLAIM IDENTITY]` → opens inline claim modal (no page navigation)
- Dismissed state stored in `localStorage` — does not re-appear after dismiss

**Claim modal — 3 steps:**
1. Enter username → live availability check (debounced 300ms)
2. Enter display name + bio (both optional)
3. Sign with wallet → POST to `/api/profile/claim` → name resolves immediately across the app

### Build Order

| Step | Work |
|---|---|
| 1 | Redis API routes (`/api/profile/*`) + schema |
| 2 | `<ChessName />` component + `useBatchProfiles` hook |
| 3 | Integrate into all 6 address display points |
| 4 | Profile page (`/app/profile/[identifier]`) |
| 5 | Claim modal + onboarding banner in lobby |
| 6 | Settings page — profile section wired to edit API |

**Status:** Not yet built.

---

### On-Chain Migration Path (Phase 2 — Do Not Begin Without Discussion)

> **This section documents a possible future direction only. Nothing here should be built until Jadon explicitly approves a separate design session covering every point below.**

The current off-chain Redis design is clean, fast, and free for users. A future on-chain migration would move name *ownership* to a smart contract while keeping profile *data* in Redis (profile data is too large and too changeable for on-chain storage).

**What would need to be discussed before starting:**
- Which chain holds the name registry — Celo only, or both Stacks and Celo?
- Gas cost model — who pays for name registration? Is there a fee? If so, where does it go?
- Name transfer mechanics — can names be transferred between wallets? Sold?
- Contract upgrade strategy — proxy pattern or immutable?
- Whether the UX friction of a gas-paying transaction for every name claim is acceptable given the protocol's free-to-play ethos
- Migration of existing off-chain names — do Redis-registered names get grandfathered in?
- What happens to profiles if the contract is compromised or deprecated?

Until every one of these questions has a documented answer agreed upon by Jadon, the system stays on Redis.
