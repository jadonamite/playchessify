# Playchessify — Handover Document

**Last updated:** 2026-06-26 | **Live on:** Celo Mainnet (`42220`)
**Repo:** `github.com/jadonamite/playchessify`

Celo-only Next.js frontend + Foundry contracts for an on-chain, free-to-play chess
protocol. Wagers use the free-to-mint CHESS token. **Chess rules are validated
off-chain** (chess.js over a Redis move relay) and **settled on-chain by a trusted
oracle** — the contract itself never validates chess.

> [!IMPORTANT]
> **Deployment state — LIVE on Celo mainnet.** ChessGame `0xb378…aE85`, ChessToken
> `0x3f7e…55a3`. Oracle/minter/gas-sponsor are the three dedicated wallets
> `0x4d68…C6c9` / `0x4548…5AB9` / `0xc26f…D0f2`. The three are dedicated single-purpose
> wallets (not the shared `Scripts` pool) so the hot oracle/minter keys are isolated and
> rotatable. The contract OWNER/deployer is `0xF679…7638` (= `EVM_MASTER_PRIVATE_KEY` in
> `Scripts/.env`). Operator keys live in the Vercel `playchessify` project (Production
> env), local `.env.local`/`.env.production`, and the gitignored `.env.tacked` backup.

---

## 📌 SESSION LOG — Landing v2 + code-quality pass (2026-06-24 → 06-26)

**Status:** on `main`, pushed to `origin/main` (working tree clean, ~0 unpushed),
deployed to prod `celo.playchessify.xyz`. `tsc`/`build` not re-verified this entry —
**clean-build before trusting** (`rm -rf .next && npm run build`).

### What changed
- **Landing replaced** — `src/app/page.tsx` now renders
  `components/landing/v2/ChessifyLanding` directly (was `Hero + Features + CTAFooter`).
  The old `/landing-v2` staging route is deprecated to a one-line note; the v2 landing
  lives at `/`. `MagicRings` (`.tsx`/`.css`) is the animated ring backdrop.
- **404 page** — `src/app/not-found.tsx` rebuilt with a 3D chess-knight model
  (`@react-three/fiber`) + animation.
- **Providers** — `getPrivyConfig()` factored out in `app/providers.tsx`; wagmi config
  got `createTransports()` (`config/wagmi.ts`).
- **Broad code-quality / cleanup pass** — large batch of refactors across `ui/`,
  `game/`, `lib/`, hooks, and `api/profile/*` (import hygiene, error handling on the
  profile/total routes, `settle-game` `getRedis()` extraction, `moves-store` record
  parser, `useSettingsStore` setter cleanup, minimax tidy in `chess-engine`). No
  architectural change — the move-relay + oracle-settlement model is unchanged.
- **`lib/index.ts`** — the dead commented-out ThemeToggle block is **gone**; file is now
  just `VERSION = "0.1.0"` + `initProtocol()` (package.json is `0.1.2`).

### Open / next up
1. Roll the **duotone/candy mobile language** across the remaining screens —
   **leaderboard, history, faucet, settings, profile** (lobby + game done).
2. **Discuss the UI direction next** (this is where the current session is headed).
3. Optional: deeper `GameClient` hook extraction (`useChessEngine` / bot-move) —
   deferred as behaviour-sensitive on a live component.

### Worktree in flight
- `worktree-coach-labels-frame` (under `.claude/worktrees/coach-labels-frame`) — coach
  portrait/label/frame work, separate from `main`. Remote branches:
  `feat/coach-portraits-webp`, `worktree-coach-labels-frame`.

---

## ⏳ PRIOR SESSION — Mobile UI makeover (2026-06-17)

Turned the "shrunk-to-fit" desktop UI into a **mobile-first, playful** (Duolingo-style)
app. Full plan: `~/.claude/plans/goofy-tumbling-eclipse.md`.

- **Icons** → **Solar bold-duotone** set in `src/components/ui/icons/index.tsx`
  (`PlayIcon`, `RankIcon`, `HistoryIcon`, `FaucetIcon`, `ProfileIcon`, `CrownIcon`,
  `HintBulbIcon`). Earlier line icons were rejected.
- **Bottom nav** `src/components/ui/BottomNav.tsx` — mobile-only fixed tab bar, 26px
  icons, candy-accent active **trapezoid** chip via `layoutId`. Hidden on `/app/game/*`,
  mounted once in client layout `src/app/app/layout.tsx`.
- **Board (mobile)** `BoardPanel.tsx` — **full-bleed 100vw, square, height-aware** via
  `.pc-board-card` (globals.css); fixed `ClayCard` `padding="md"` override → `"none"`.
- **Game action bar** `GameActionBar.tsx` — **80% trapezoid CTA + 20% bulb**; active play
  → "Hold to Quit/Resign" with left→right battery fill; game over → "New Game".
- **Tokens** (`globals.css`) — `--candy-grape/lime/amber/rose`, `--bottom-nav-h`,
  `--board-reserve`, `.pc-bottom-nav` / `.pc-app-scroll` / `.pc-board-card` / `.pc-bulb-glow`.
- **Lobby** `LobbyContent.tsx` — mobile-first hero (glossy orb + `CrownIcon`), candy stat
  chips, tactile cards. **Logo** bumped in `Navbar.tsx`.

### Gotchas (still current)
- **Headless screenshots render blank** — `/app/*` is Privy-wallet-gated; can't
  auto-verify authed UI. Verify via device or mock the wallet.
- **Clean build before trusting** — `rm -rf .next && npm run build` (stale cache
  has hidden Turbopack errors before).
- **Auto-commit worker is ACTIVE** — `~/Projects/Scripts/Elite.cjs` (NVIDIA-NIM
  conventional-commit messages, deterministic fallback) commits this repo every ~1–7 min;
  the older gitignored `.committer.sh` does plain `chore(wip): auto-checkpoint #N` checkpoints.
  Expect your edits to be auto-committed under bot messages mid-session (e.g. this doc pass
  landed as `docs: update DEPLOY, README, TODO …`). Stop with `pkill -f Elite.cjs` /
  `pkill -f .committer.sh`. `main` history carries these wip/bot commits (kept as-is per
  decision — no rebase/squash).

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16, App Router, TypeScript |
| Chain | Celo — Mainnet (`42220`) or Alfajores (`44787`), env-selectable |
| Contracts | Solidity 0.8.20 (OpenZeppelin), Foundry (`celo-contracts/`) |
| Wallet/Auth | Privy — embedded wallets + social login + ERC-4337 smart wallets (`@privy-io/react-auth` + `@privy-io/wagmi` + `/smart-wallets`) |
| Chain state | Wagmi + Viem (`multicall` for batch reads) |
| Server state | `@tanstack/react-query` |
| Client state | Zustand (`useSettingsStore`, `useToastStore`) |
| Move relay + profiles | Upstash Redis (off-chain) |
| Settlement worker | Vercel Cron → `/api/cron/settle` (daily, `0 0 * * *` — Hobby-plan limit; relay freeze makes latency non-blocking) |
| Audio | Two looped MP3 tracks + Web Audio API move SFX |
| Chess logic | `chess.js` (client board + server settlement) |
| Board UI | `react-chessboard` (dynamic import, SSR off) |
| 3D | `@react-three/fiber` + `@react-three/drei` |

---

## Wallet capability tiers

The on-chain "player" identity and the gas mechanism both depend on the tier
(`src/components/wallet-provider.tsx`):

| Tier | Detected as | Player identity | Gas / sponsorship |
|---|---|---|---|
| `minipay` | `window.ethereum.isMiniPay` | connected EOA | Server drips USDm gas + mints CHESS (`/api/gas/sponsor`); legacy tx with `feeCurrency = USDm`. Can't sign messages. |
| `smart` | Privy smart-wallet client active | smart-account address | ERC-4337 userOp sponsored by Pimlico paymaster (configured in the Privy dashboard) |
| `eoa` | external injected wallet | connected EOA | User pays own gas |

`playerAddress` = smart-account address for Tier A, otherwise the connected EOA —
always matches `white`/`black` on-chain.

---

## Contract addresses (Celo)

```
# LIVE on Celo mainnet — set via NEXT_PUBLIC_CELO_TOKEN / NEXT_PUBLIC_CELO_GAME.
ChessToken: 0x3f7efdfc8a76f76f22512fcd2bddc5fca36e55a3
ChessGame:  0xb37877a9ebd6c3169b2eaaa3e16852839785ae85

# Operators (env keys): oracle 0x4d68…C6c9 · minter 0x4548…5AB9 · gas-sponsor 0xc26f…D0f2.
# Owner/deployer: 0xF679…7638. config/contracts.ts still *defaults* to old pre-oracle
# addresses (0xE370… / 0xf85f…) for safety — the live values come from env, not the default.
```

Constants: `TOKEN_DECIMALS = 6` · faucet = 1,000 CHESS · `FAUCET_COOLDOWN = 17,280`
blocks (~1 day at Celo's 5 s blocks) · `EXPIRY_BLOCKS = 17,280` · `STARTING_ELO = 1200`
· `K_FACTOR = 32` · `MIN_RATING = 100`.

> `config/contracts.ts` now carries the correct Celo values (`FAUCET_COOLDOWN = 17_280`,
> `BLOCK_TIME_SECS = 5`) — the old 10-min-block constants (144 / 600) were fixed. The
> authoritative cooldown remains the contract's 17,280 blocks.

---

## Contracts

### `ChessToken.sol` — free-to-play ERC-20

`balanceOf, allowance, approve` (standard) · `faucetClaim()` (1,000 CHESS / ~day) ·
`faucetCooldownRemaining(addr)` · `mint(to,amount)` (owner) · `batchMint(...)` (owner) ·
`mintTo(to,amount)` (**onlyMinter** — server provisions CHESS to fresh MiniPay wallets so
they never spend gas on `faucetClaim`) · `setMinter(addr)` (owner) · `setMintEnabled(bool)`
(owner) · `decimals() = 6`.

### `ChessGame.sol` — lifecycle, escrow, Elo, oracle settlement

```
createGame(wager)                 → locks white's CHESS, returns gameId (event GameCreated)
joinGame(gameId)                  → locks black's matching wager, status → Active
resign(gameId)                    → caller loses, opponent wins (self-harm only)
proposeDraw(gameId)               → offer draw
acceptDraw(gameId)                → both refunded
settleGame(gameId, result)        → ONLY THE ORACLE (onlyOracle). Declares Win/Draw, pays pot.
cancelGame(gameId)                → creator cancels while Waiting, refunded
reclaimExpired(gameId)            → either player split-refunds escrow after EXPIRY_BLOCKS
setOracle(addr)                   → owner; rotatable hot key
getGame / getPlayerStats / totalGames / canReclaim / gameNonce / oracle   (reads)
```

**`getGame(gameId)` struct (7 fields — `turn`/`moveCount`/`lastMoveBlock` were removed
when moves moved off-chain):**

```
white, black            address
wager                   uint256
status                  uint8  — 0 Waiting · 1 Active · 2 Finished · 3 Cancelled · 4 Draw
result                  uint8  — 0 None · 1 WhiteWins · 2 BlackWins · 3 DrawResult · 4 Cancelled
createdAt               uint256 (block number)
drawProposer            address (0x0 if none)
```

**`playerStats(addr)`** → `wins, losses, draws, rating, gamesPlayed` (all uint256).

**Trust model (from the contract header):** `create/join/resign/propose/acceptDraw/cancel`
are `msg.sender`-based and self-custodial — a caller can only hurt themselves, and they
work identically for EOAs and ERC-4337 accounts. `settleGame` is the *only* way to declare
a winner and only the oracle can call it; funds can only ever go to white/black/split, never
the oracle. `reclaimExpired` is the oracle-independent backstop. Tests in
`celo-contracts/test/` prove non-oracle settle reverts (`test_Settle_RevertsForNonOracle`),
double-settle reverts, reclaim windows, and Elo math.

---

## Off-chain move relay

Moves never touch the chain. `useGameMoves` ↔ `/api/games/celo/[id]/moves` ↔ Redis.

**Redis keys** (`src/lib/moves-store.ts`):
```
chess:moves:celo:{gameId}   → LIST of MoveRecord JSON (30-day TTL, reset on each write)
chess:active:celo           → SET of live gameIds (the settlement worker's sweep list)
```

**MoveRecord:** `{ san, player, moveNumber, ts, sig?, signer? }`.

> **Per-move signing is currently OFF (since `297f5c4`, 2026-06-18).** The client submits
> every move **unsigned, for all tiers** — `GameClient` calls `relaySubmitMove` with no signer,
> and `useMoveSigner` is dead code (not wired to any component). Moves are authenticated purely
> by the relay's turn/legality/participant binding (the "trusted middleman" model). The signing
> infrastructure is dormant, not deleted: the relay still verifies a `sig` *if present*, and
> `MoveRecord.sig`/`signer` remain in the type — so it can be re-enabled for a future signed
> high-stakes mode. (Task: keep dormant vs delete.)

**POST move authentication** (`moves/route.ts`): rejects duplicate `moveNumber` (race guard,
409); reads `getGame` (must be Active); **rejects a move once the move clock is exceeded**
(last move older than `MOVE_TIMEOUT_MS` → 409 "move window expired", so a returning opponent
can't undo a timeout during the settling window); replays history to derive side-to-move and
rejects if `player` isn't that side (403); rejects illegal moves (422); if a `sig` is present,
verifies it against the canonical message via `verifyWalletSignature` (EIP-1271-aware, 401 on
fail — dormant path today); appends and registers the game as active.

**Signing (dormant)** (`useMoveSigner` + `settlement.canonicalMoveMessage`): when re-enabled, the
signed string binds chain + gameId + ply + SAN + resulting FEN, so a signature can't be replayed
onto another move. `useGameMoves.moveMessage` must stay byte-identical to `canonicalMoveMessage`.

---

## On-chain settlement (oracle)

`src/lib/settle-game.ts` → `settleGameById(chain, gameId)`:

1. `getMoves` from Redis.
2. `getOnchainGame`; if not Active → unregister + `not-active` (idempotent no-op).
3. `signedMovesValid` — re-verify every signed move; tamper → `forged-signature`.
4. `deriveResult` (`settlement.ts`) — replay with chess.js: checkmate → winner;
   stalemate/insufficient material/3-fold/50-move → draw; else a 5-minute move-clock
   (`MOVE_TIMEOUT_MS`) forfeit; otherwise `not-terminal`. `illegal` if the SAN list doesn't replay.
5. Redis lock `chess:settle:celo:{gameId}` (nx, 120 s); contended → `in-progress`.
6. `settleOnChain` (oracle key) submits `settleGame`, waits for receipt, unregisters the game.
   On error the lock is deleted so it can retry.

**Two triggers:**
- **Client fast path** — `useCeloChess.requestSettle` → `POST /api/games/celo/[id]/settle`,
  fired by `GameClient` once the board is terminal or the opponent's 5-min clock expires
  (guarded by a `useRef`; a failed request clears the guard to retry).
- **Guaranteed fallback** — `GET /api/cron/settle` sweeps `chess:active:celo` **once a day**
  (`vercel.json` `0 0 * * *` — the Vercel Hobby plan only allows daily crons), protected by
  `CRON_SECRET`, so a finished game still settles even if both players close their tabs. The
  daily cadence is **not a correctness risk**: the relay freezes the game at the move-clock
  deadline (rejects late moves), so the outcome is locked off-chain the moment it's decided —
  only the on-chain payout waits for the sweep, and nobody can change who won in the meantime.

`GameResult` enum is mirrored in three places that must agree: `ChessGame.sol`,
`celo-server.ts`, and `settlement.RESULT` (`WhiteWins 1 · BlackWins 2 · Draw 3`).

---

## Gas sponsorship (Tier B / MiniPay + Tier C / external EOA)

> All amounts are in **USDm** (Mento Dollar — the cUSD rebrand: same contract, same 18 decimals).

`POST /api/gas/sponsor` (`celo-server.ts` wallets) — `tier: 'minipay'` (USDm) or `'eoa'` (CELO):

**Tier B / MiniPay (USDm):**
- Fast path: wallet already has ≥ `MIN_GAS_USDM` (0.01 USDm) → skip (still top up CHESS if < 100).
- Drip: provisions 1,000 CHESS via `mintTo` (if low) + drips `GAS_DRIP_USDM` (0.03 USDm) via the
  gas-sponsor wallet.
- **Graceful degradation:** if the sponsor wallet can't cover the drip (`gasSponsorCanCover`),
  returns `{ degraded: true }` (a signal, not a 500) and the client falls back to self-pay.

**Tier C / external EOA (native CELO):**
- Fast path: wallet already has ≥ `MIN_GAS_CELO` (0.01 CELO) → skip.
- Drip: `CELO_DRIP_AMOUNT` (0.005 CELO) via `sponsorCelo` (guarded by `gasSponsorCanCoverCelo`),
  separate `chess:gas-celo:*` Redis keys.

- **Sybil guards (both tiers):** per-address cooldown (1 h), per-address in-flight lock (60 s),
  global daily cap (1,000).

Client side (`useCeloChess`): `ensureGasSponsored` polls the wallet's real USDm/CELO balance
(`pollUntilGas` / `pollUntilCeloGas`, 12×1 s) before estimating gas — no blind sleep — and
returns a typed `GasStatus` (`sponsored | has-gas | self-pay`). `assertCanSelfPay` stops with a
clear message if the user genuinely has no USDm/CELO. Tier A retries a sponsored userOp once on a
transient paymaster/bundler error (`isSponsorshipError`); it deliberately does **not**
identity-switch to the embedded EOA (that would change the on-chain player mid-game).

---

## App routes

| Route | Component | Notes |
|---|---|---|
| `/` | `ChessifyLanding` (v2) | landing; redirects to lobby if connected. (`Hero`/`Features`/`CTAFooter` are the retired v1 landing, still in `components/landing/`.) |
| `/app` | guard | redirect to lobby if connected |
| `/app/lobby` | `LobbyContent` | open games (last 10 scan), create/join, `.chess` onboarding banner |
| `/app/game/[id]` | `GameClient` | `id` numeric or `'bot'` (local minimax) |
| `/app/history` | `HistoryContent` | connected wallet's games via `/api/history` (Redis-indexed) |
| `/app/leaderboard` | `LeaderboardContent` | Elo via `/api/leaderboard` (Redis-indexed), podium + pagination |
| `/app/profile/[identifier]` | profile page | `0x` address or `username` (`.chess`) |
| `/app/settings` | settings page | sound, board theme, piece set, AI difficulty, move hints, profile edit |
| `/app/faucet` | `FaucetContent` | claim 1,000 CHESS |

---

## `.chess` naming system (off-chain Upstash — no contract)

> **CRITICAL CONSTRAINT:** intentionally off-chain. There is **no smart contract** for names.
> Building one is a Phase-2 decision requiring an explicit design session (gas model, transfers,
> migration). Do not start migration work without that.

**Redis keys** (`src/lib/profile-store.ts`): `chess:profile:addr:{addr}` (JSON),
`chess:profile:name:{username}` (→ addr), `chess:profile:namelock:{addr}`,
`chess:profile:total`, `chess:profile:recent` (last 50), `chess:profile:rl:{action}:{addr}`.

**`ChessProfile`** (`src/types/profile.ts`): `address, username, displayName, bio, og,
createdAt, updatedAt, usernameChangedAt`.

**Rules:** username `^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$` (3–20, no leading/trailing or consecutive
hyphens), reserved-word blocklist, 30-day change lock, first 100 profiles get `og: true` forever.

**Auth:** no sessions. Every mutating call carries `signature` + `timestamp`; the server runs
`viem.verifyMessage` and rejects timestamps older than 5 min (replay protection). Rate limits:
claim 2/24 h, update 5/h.

```
GET   /api/profile/[address]          → { profile } | 404
PATCH /api/profile/[address]          → update (sig required)
POST  /api/profile/claim              → create (sig required)
GET   /api/profile/name/[username]    → { profile } | 404
GET   /api/profile/check/[username]   → { available, reason? }
POST  /api/profile/batch              → { profiles: Record<addr, profile|null> } (≤200)
GET   /api/profile/recent             → { profiles } (last 10)
GET   /api/profile/total              → { total }
```

Components: `<ChessName asLink? badge? short? />`, `<ChessAvatar />` (deterministic SVG from
address bytes), `<ClaimModal />` (2-step sign-to-claim). Hooks: `useProfile`,
`useCheckUsername`, `useClaimProfile`, `useUpdateProfile`, `useBatchProfiles` (single MGET).

---

## Settings (`useSettingsStore`, persisted to `localStorage['chessify-settings']`)

- `soundEnabled` (bool)
- `boardTheme` — `dark` (default) · `forest` · `classic` · `midnight`
- `pieceSet` — `chessnut` (default) · `caliente` · `maestro` · `fresca` · `cooke` (SVGs in `public/pieces/<set>/`)
- `aiDifficulty` — `easy`=depth 1 · `medium`=2 · `hard`=3 (bot minimax in `lib/chess-engine.ts`)
- `showMoveHints` — highlight legal destinations on pickup

---

## Audio (`src/lib/audio.ts` + `AudioManager`)

Two looped **MP3** tracks under `public/music/` (landing/lobby + game), cross-faded by route;
Web Audio API synthesises only the per-move SFX (`playMoveSound`/`playMoveChime`). `AudioManager`
starts ambient on first user interaction (autoplay policy) and switches tracks on route change;
`setMuted` honours the sound setting without restarting.

---

## Key file map

```
src/
├── app/
│   ├── providers.tsx                 ← Query + Privy + Wagmi + SmartWallets + Theme + Toast + Audio
│   ├── app/{lobby,game/[id],history,leaderboard,profile/[identifier],settings,faucet}/
│   └── api/
│       ├── games/[chain]/[id]/moves/route.ts   ← relay GET/POST (authenticated)
│       ├── games/[chain]/[id]/settle/route.ts  ← client-triggered settle
│       ├── cron/settle/route.ts                ← settlement sweep worker (CRON_SECRET)
│       ├── gas/sponsor/route.ts                ← Tier B USDm drip + provision, Tier C CELO drip (sybil-guarded)
│       ├── leaderboard/route.ts               ← Redis-indexed leaderboard (20 s cache)
│       ├── history/route.ts                   ← Redis-indexed per-player history (?address=)
│       └── profile/{[address],name/[username],check/[username],claim,batch,recent,total}/
├── components/
│   ├── game/                         ← GameClient (orchestrator) + BoardPanel, GameSidebar,
│   │                                   GameHeader, GameResultOverlay, MoveLog, CapturedTray
│   ├── lobby/{LobbyContent,HistoryContent,LeaderboardContent}.tsx
│   ├── ui/{ChessName,ChessAvatar,ClaimModal,Navbar,ChainSelectModal,GameStatusModal,...}.tsx
│   ├── landing/v2/ChessifyLanding.tsx ← current landing (+ MagicRings.tsx/.css)
│   ├── landing/Hero.tsx              ← retired v1 landing; re-exports Navbar
│   └── wallet-provider.tsx           ← tier detection, MiniPay auto-connect, playerAddress
├── hooks/
│   ├── useCeloChess.ts               ← createGame/joinGame/resign/proposeDraw/acceptDraw + gas tiers
│   ├── useGameMoves.ts               ← relay read/write/poll (2 s)
│   ├── useMoveSigner.ts              ← per-tier move signing
│   ├── useGameData.ts                ← getGame poll + derived identity/status flags (for GameClient)
│   ├── useLobby / useLeaderboard / useHistory / usePlayerHistory   ← fetch the indexed API routes
│   └── useProfile / useBatchProfiles / useSettingsStore / useToastStore
├── lib/
│   ├── celo-server.ts                ← SERVER ONLY — oracle/minter/gas-sponsor wallets, reads
│   ├── game-index.ts                 ← Redis game index: cursor + player set + per-player games
│   │                                   (so leaderboard/history scan only new games, not the table)
│   ├── settle-game.ts                ← settleGameById (shared by route + cron)
│   ├── settlement.ts                 ← CLIENT-SAFE — canonicalMoveMessage, deriveResult
│   ├── moves-store.ts                ← Redis move/active-set CRUD
│   ├── profile-store.ts              ← Redis profile CRUD + username rules
│   ├── chess-engine.ts               ← minimax bot (PSTs, MVV-LVA) + hint + capture summary
│   ├── audio.ts · avatar.ts · chessPieces.tsx
│   └── index.ts                      ← placeholder SDK (VERSION + initProtocol; dead block removed)
├── config/{contracts.ts, abis.ts, wagmi.ts}
└── types/profile.ts
celo-contracts/                       ← Foundry: src/ (ChessToken, ChessGame), script/Deploy.s.sol, test/
vercel.json                          ← cron: /api/cron/settle daily (0 0 * * *, Hobby-plan limit)
```

---

## Environment variables

```bash
# Client (NEXT_PUBLIC_*)
NEXT_PUBLIC_PRIVY_APP_ID
NEXT_PUBLIC_CELO_TOKEN          # set to freshly deployed token after DEPLOY.md
NEXT_PUBLIC_CELO_GAME           # set to freshly deployed game after DEPLOY.md
NEXT_PUBLIC_CELO_NETWORK        # 'alfajores' for rehearsal; anything else = mainnet
NEXT_PUBLIC_FEE_CURRENCY        # optional USDm fee-currency override (defaults per network)

# Server (gitignored)
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
ORACLE_PRIVATE_KEY              # calls settleGame
MINTER_PRIVATE_KEY             # calls token.mintTo
GAS_SPONSOR_PRIVATE_KEY        # drips USDm gas (Tier B) + native CELO (Tier C)
CRON_SECRET                    # Bearer guard for /api/cron/settle

# Foundry deploy (see DEPLOY.md): DEPLOYER_PRIVATE_KEY, ORACLE_ADDRESS, MINTER_ADDRESS, CELOSCAN_API_KEY
# Privy dashboard (Tier A): Pimlico bundler/paymaster URLs + PIMLICO_API_KEY
```

The oracle/minter/gas-sponsor wallets all hold CELO so their own txs pay gas natively. Keep them
as separate keys for rotation; they may share one key initially.

---

## What's not built yet

| Feature | Notes |
|---|---|
| Tier C meta-tx forwarder | ERC-2771 forwarder + `*WithSig`/permit funcs so external EOAs are truly gasless (no CELO line in their wallet). Needs a contract redeploy + escrow migration; the interim native-CELO drip covers them today. |
| Game replay viewer · player search · recent-profiles feed · opponent-join notifications | Not built. |
