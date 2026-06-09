# Playchessify — Handover Document

**Last updated:** 2026-06-09 | **Live on:** Celo (Mainnet target; Alfajores rehearsal)
**Repo:** `github.com/jadonamite/playchessify`

Celo-only Next.js frontend + Foundry contracts for an on-chain, free-to-play chess
protocol. Wagers use the free-to-mint CHESS token. **Chess rules are validated
off-chain** (chess.js over a Redis move relay) and **settled on-chain by a trusted
oracle** — the contract itself never validates chess.

> [!IMPORTANT]
> **Deployment state.** The contracts in `celo-contracts/` (oracle settlement, minter,
> gas-sponsor backstop) are **not deployed yet**. `src/config/contracts.ts` still
> defaults to the *old* pre-oracle addresses (`0xE370…` / `0xf85f…`). Nothing works
> end-to-end against those — the frontend ABI already targets the new functions
> (`settleGame`, `reclaimExpired`, `mintTo`) and has dropped `submitMove`/`reportWin`.
> The whole oracle/gas system goes live only after the deploy in **DEPLOY.md**.

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
| Settlement worker | Vercel Cron → `/api/cron/settle` (every minute) |
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
| `minipay` | `window.ethereum.isMiniPay` | connected EOA | Server drips cUSD gas + mints CHESS (`/api/gas/sponsor`); legacy tx with `feeCurrency = cUSD`. Can't sign messages. |
| `smart` | Privy smart-wallet client active | smart-account address | ERC-4337 userOp sponsored by Pimlico paymaster (configured in the Privy dashboard) |
| `eoa` | external injected wallet | connected EOA | User pays own gas |

`playerAddress` = smart-account address for Tier A, otherwise the connected EOA —
always matches `white`/`black` on-chain.

---

## Contract addresses (Celo)

```
# CURRENT DEFAULTS in config/contracts.ts — these are the OLD pre-oracle contracts.
ChessToken (old): 0xE370aad742dF8DC8Ae9c0F0b9f265334D39e2197
ChessGame  (old): 0xf85f00D39A84b5180390548Ea9f76B0458607E78

# After running DEPLOY.md, set NEXT_PUBLIC_CELO_TOKEN / NEXT_PUBLIC_CELO_GAME to the
# freshly deployed addresses. Old free-faucet balances are abandoned (pre-launch).
```

Constants: `TOKEN_DECIMALS = 6` · faucet = 1,000 CHESS · `FAUCET_COOLDOWN = 17,280`
blocks (~1 day at Celo's 5 s blocks) · `EXPIRY_BLOCKS = 17,280` · `STARTING_ELO = 1200`
· `K_FACTOR = 32` · `MIN_RATING = 100`.

> Note: `config/contracts.ts` still carries `FAUCET_COOLDOWN = 144` / `BLOCK_TIME_SECS = 600`
> from an old 10-min-block assumption. These are display-only and wrong for Celo (5 s blocks);
> the authoritative cooldown is the contract's 17,280 blocks.

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

**MoveRecord:** `{ san, player, moveNumber, ts, sig?, signer? }`. `sig`/`signer` present
for Tier A/C (signed); absent for MiniPay (turn-bound only).

**POST move authentication** (`moves/route.ts`): rejects duplicate `moveNumber` (race guard,
409); reads `getGame` (must be Active); replays history to derive side-to-move and rejects
if `player` isn't that side (403); rejects illegal moves (422); if a `sig` is present, verifies
it against the canonical message via `verifyWalletSignature` (EIP-1271-aware, 401 on fail);
appends and registers the game as active.

**Signing** (`useMoveSigner` + `settlement.canonicalMoveMessage`): the signed string binds
chain + gameId + ply + SAN + resulting FEN, so a signature can't be replayed onto another move.
`useGameMoves.moveMessage` must stay byte-identical to the server's `canonicalMoveMessage`.

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
- **Guaranteed fallback** — `GET /api/cron/settle` sweeps `chess:active:celo` every minute
  (`vercel.json`, protected by `CRON_SECRET`), so a finished game settles even if both
  players close their tabs.

`GameResult` enum is mirrored in three places that must agree: `ChessGame.sol`,
`celo-server.ts`, and `settlement.RESULT` (`WhiteWins 1 · BlackWins 2 · Draw 3`).

---

## Gas sponsorship (Tier B / MiniPay)

`POST /api/gas/sponsor` (`celo-server.ts` wallets):
- Fast path: wallet already has ≥ `MIN_GAS_CUSD` (0.01 cUSD) → skip (still top up CHESS if < 100).
- Drip: provisions 1,000 CHESS via `mintTo` (if low) + drips `GAS_DRIP_CUSD` (0.03 cUSD) via the
  gas-sponsor wallet.
- **Graceful degradation:** if the sponsor wallet can't cover the drip (`gasSponsorCanCover`),
  returns `{ degraded: true }` (a signal, not a 500) and the client falls back to self-pay.
- **Sybil guards:** per-address cooldown (1 h), per-address in-flight lock (60 s), global daily
  cap (1,000).

Client side (`useCeloChess`): `ensureGasSponsored` polls the wallet's real cUSD balance
(`pollUntilGas`, 12×1 s) before estimating gas — no blind sleep — and returns a typed
`GasStatus` (`sponsored | has-gas | self-pay`). `assertCanSelfPay` stops with a clear message
if the user genuinely has no cUSD. Tier A retries a sponsored userOp once on a transient
paymaster/bundler error (`isSponsorshipError`); it deliberately does **not** identity-switch to
the embedded EOA (that would change the on-chain player mid-game).

---

## App routes

| Route | Component | Notes |
|---|---|---|
| `/` | `Hero` + `Features` + `CTAFooter` | landing; redirects to lobby if connected |
| `/app` | guard | redirect to lobby if connected |
| `/app/lobby` | `LobbyContent` | open games (last 10 scan), create/join, `.chess` onboarding banner |
| `/app/game/[id]` | `GameClient` | `id` numeric or `'bot'` (local minimax) |
| `/app/history` | `HistoryContent` | connected wallet's on-chain games |
| `/app/leaderboard` | `LeaderboardContent` | Elo via `playerStats` multicall, podium + pagination |
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
│       ├── gas/sponsor/route.ts                ← Tier B drip + provision (sybil-guarded)
│       └── profile/{[address],name/[username],check/[username],claim,batch,recent,total}/
├── components/
│   ├── game/GameClient.tsx           ← board, relay moves, signing, auto-settle, 5-min clock
│   ├── lobby/{LobbyContent,HistoryContent,LeaderboardContent}.tsx
│   ├── ui/{ChessName,ChessAvatar,ClaimModal,Navbar,ChainSelectModal,GameStatusModal,...}.tsx
│   ├── landing/Hero.tsx              ← landing; re-exports Navbar
│   └── wallet-provider.tsx           ← tier detection, MiniPay auto-connect, playerAddress
├── hooks/
│   ├── useCeloChess.ts               ← createGame/joinGame/resign/requestSettle + gas tiers
│   ├── useGameMoves.ts               ← relay read/write/poll (2 s)
│   ├── useMoveSigner.ts              ← per-tier move signing
│   ├── useLobby / useLeaderboard / useHistory / usePlayerHistory
│   └── useProfile / useBatchProfiles / useSettingsStore / useToastStore
├── lib/
│   ├── celo-server.ts                ← SERVER ONLY — oracle/minter/gas-sponsor wallets, reads
│   ├── settle-game.ts                ← settleGameById (shared by route + cron)
│   ├── settlement.ts                 ← CLIENT-SAFE — canonicalMoveMessage, deriveResult
│   ├── moves-store.ts                ← Redis move/active-set CRUD
│   ├── profile-store.ts              ← Redis profile CRUD + username rules
│   ├── chess-engine.ts               ← minimax bot (PSTs, MVV-LVA) + hint + capture summary
│   ├── audio.ts · avatar.ts · chessPieces.tsx
│   └── index.ts                      ← placeholder SDK (has dead commented ThemeToggle block)
├── config/{contracts.ts, abis.ts, wagmi.ts}
└── types/profile.ts
celo-contracts/                       ← Foundry: src/ (ChessToken, ChessGame), script/Deploy.s.sol, test/
vercel.json                          ← cron: /api/cron/settle every minute
```

---

## Environment variables

```bash
# Client (NEXT_PUBLIC_*)
NEXT_PUBLIC_PRIVY_APP_ID
NEXT_PUBLIC_CELO_TOKEN          # set to freshly deployed token after DEPLOY.md
NEXT_PUBLIC_CELO_GAME           # set to freshly deployed game after DEPLOY.md
NEXT_PUBLIC_CELO_NETWORK        # 'alfajores' for rehearsal; anything else = mainnet
NEXT_PUBLIC_FEE_CURRENCY        # optional cUSD override (defaults per network)

# Server (gitignored)
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
ORACLE_PRIVATE_KEY              # calls settleGame
MINTER_PRIVATE_KEY             # calls token.mintTo
GAS_SPONSOR_PRIVATE_KEY        # drips cUSD gas
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
| Contract deploy + env wiring | The blocking step — see DEPLOY.md. Old addresses are still the defaults. |
| Alfajores rehearsal matrix | Tier A/B sponsorship, draw/timeout/resign, reclaimExpired, sybil — before mainnet. |
| Leaderboard / history scaling | Full `gameNonce` multicall scans; will need a cursor or Redis index as games grow. |
| GameClient refactor | Still a ~1,000-line monolith (see game_refactor_plan.md). |
| Game replay viewer · player search · recent-profiles feed · opponent-join notifications | Not built. |
```
