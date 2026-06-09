# ♟️ Chessify Protocol — Comprehensive Project Progress & Context

> [!WARNING]
> **SUPERSEDED — historical only (as of 2026-06-09).** This document describes the *old*
> multi-chain **Chessify** repo (Stacks + Celo, 2-contract Clarity/Solidity system, the
> `chessify-protocol` NPM package, simulation scripts) and an on-chain per-move (`submit-move`)
> / `report-win` model. **Playchessify is now Celo-only** with off-chain move relay + oracle
> settlement (`settleGame`), and the contract has no `submitMove`/`reportWin`/`turn`/`moveCount`.
> For current architecture read **handover.md**; for release steps read **DEPLOY.md**. This file
> is kept for history of the earlier protocol work only — do not treat it as current state.

> **PURPOSE OF THIS DOCUMENT**: This file serves as the canonical onboarding context for any LLM or developer picking up this project. It describes the full architecture, deployed state, file-by-file inventory, known issues, and roadmap. Read this before touching any code.

**Current Phase**: Phase 3 — Multi-Chain Integration (Hybrid Proto-Launch)  
**Last Updated**: April 23, 2026  
**Repo**: `github.com/jadonamite/Chessify`  
**NPM Package**: `chessify-protocol@0.1.2` (public, MIT)  
**Author**: `jadonamite`

---

## 📐 Project Identity

Chessify is a **free-to-play, fully on-chain chess protocol** deployed across two blockchains:

| Chain | Language | Status | Token Standard |
|-------|----------|--------|----------------|
| **Stacks** (Bitcoin L2) | Clarity 2/4 | ✅ Mainnet | SIP-010 Fungible Token |
| **Celo** (EVM) | Solidity 0.8.20 | ✅ Mainnet | ERC-20 |

**Economic Model**: CHESS tokens are free (faucet-minted, 1,000 CHESS/day). STX and CELO are used for gas only. Zero financial risk. Wagers use CHESS exclusively.

---

## 🗂️ Repository Structure

```
chess-protocol/
├── contracts/                    # Stacks Clarity smart contracts (ACTIVE)
│   ├── chess-token.clar          # Legacy SIP-010 token (v1, NOT deployed to mainnet)
│   ├── chess-token_v2.clar       # Legacy token v2 (NOT deployed to mainnet)
│   ├── chess-token-v3.clar       # ✅ ACTIVE: SIP-010 token with gateway-release pattern
│   ├── chess-game.clar           # ✅ ACTIVE: Consolidated game engine + escrow + Elo
│   ├── chess-escrow.clar         # Legacy standalone escrow (superseded by chess-game.clar)
│   ├── registry.clar             # Legacy game registry (superseded by chess-game.clar)
│   ├── logic.clar                # Legacy move logic (superseded by chess-game.clar)
│   ├── timer.clar                # Legacy timeout system (superseded by chess-game.clar)
│   ├── ranking.clar              # Legacy Elo ranking (superseded by chess-game.clar)
│   ├── router.clar               # Legacy router (superseded by chess-game.clar)
│   ├── gateway.clar              # Legacy gateway v1 (superseded)
│   ├── gateway_v2.clar           # Legacy gateway v2 (superseded)
│   └── automata-agent.clar       # ✅ ACTIVE: On-chain attestation for AI agent actions
│
├── celo-contracts/               # EVM Solidity contracts (deployed via Remix)
│   ├── ChessToken.sol            # ERC-20 CHESS token (faucet, mint, batch-mint)
│   └── ChessGame.sol             # Game engine (escrow, Elo, lifecycle) — mirrors chess-game.clar
│
├── src/                          # Next.js 16 frontend application
│   ├── app/
│   │   ├── layout.tsx            # Root layout with Inter font, metadata
│   │   ├── page.tsx              # Landing page (renders Hero + Features + CTAFooter)
│   │   ├── providers.tsx         # Wagmi + React Query + WalletProvider setup (Celo only)
│   │   └── globals.css           # Global CSS (13KB — premium dark theme)
│   ├── components/
│   │   ├── landing/
│   │   │   ├── Hero.tsx          # Hero section with animated chess visuals (21KB)
│   │   │   ├── Features.tsx      # Feature cards with icons and descriptions
│   │   │   └── CTAFooter.tsx     # Call-to-action footer
│   │   ├── ui/
│   │   │   ├── GlowButton.tsx    # Animated glowing CTA button component
│   │   │   ├── ClayCard.tsx      # Neumorphic card component
│   │   │   ├── StatBadge.tsx     # Stats display badge
│   │   │   └── ThemeToggle.tsx   # Dark/light theme toggle
│   │   └── wallet-provider.tsx   # Custom EVM wallet context (MiniPay-aware)
│   ├── config/
│   │   └── contracts.ts          # All contract addresses + chain config (see below)
│   ├── lib/
│   │   └── index.ts              # NPM package entry point (exports VERSION, initProtocol)
│   └── files/
│       ├── globals.css           # Alternate/archived CSS
│       └── tailwind.config.ts    # Archived Tailwind config
│
├── tests/                        # Vitest + Clarinet SDK unit tests
│   ├── chess-token.test.ts       # Token contract tests (scaffold only)
│   ├── escrow.test.ts            # Escrow contract tests (scaffold only)
│   ├── logic.test.ts             # Logic contract tests (scaffold only)
│   ├── ranking.test.ts           # Ranking contract tests (scaffold only)
│   ├── registry.test.ts         # Registry contract tests (scaffold only)
│   ├── router.test.ts            # Router contract tests (scaffold only)
│   └── timer.test.ts             # Timer contract tests (scaffold only)
│
├── scripts/
│   └── generate-stacks-wallets.js  # Generates Stacks wallet keypairs for simulation
│
├── deployments/                  # Clarinet deployment plans
│   ├── default.mainnet-plan.yaml
│   ├── default.simnet-plan.yaml
│   └── default.testnet-plan.yaml
│
├── dist/                         # Built NPM package output (tsup)
│   ├── index.js
│   ├── index.js.map
│   └── index.d.ts
│
├── ── Simulation & Operations Scripts ──
│   ├── simulate-celo.cjs         # ✅ Celo mainnet simulation (15+ wallets, full lifecycle)
│   ├── simulate-stacks.js        # ✅ Stacks mainnet simulation (game lifecycle)
│   ├── simulate-automata.js      # Automata agent attestation simulation
│   ├── distribute-stacks.js      # STX distribution to simulation wallets (resilient)
│   ├── distribute-stacks-test.js # STX distribution test variant
│   ├── distribute_celo.js        # CELO distribution to simulation wallets
│   ├── fetch_celo_balances.js    # Fetches CELO balances across wallets
│   ├── icarus.js                 # Advanced Stacks simulation orchestrator
│   ├── artist.cjs                # Creative simulation script variant
│   ├── Elite.cjs                 # Elite simulation runner
│   ├── TheQueenGambit.cjs        # Patches simulate-stacks.js (retry, contract ref fixes)
│
├── ── Configuration ──
│   ├── package.json              # NPM config — chessify-protocol@0.1.2
│   ├── Clarinet.toml             # Stacks dev environment (automata-agent + chess-game)
│   ├── tsconfig.json             # TypeScript config
│   ├── tsconfig.lib.json         # Library-specific TS config
│   ├── tsup.config.ts            # Bundle config for NPM package
│   ├── vitest.config.ts          # Test runner config
│   ├── eslint.config.mjs         # ESLint config
│   ├── postcss.config.mjs        # PostCSS config
│   ├── next.config.ts            # Next.js 16 config
│   ├── .env                      # Environment variables (private keys, RPCs)
│   └── .gitignore
│
├── AGENTS.md                     # LLM agent rules (Next.js breaking changes warning)
├── CLAUDE.md                     # Claude-specific instructions
├── README.md                     # Full architecture documentation (legacy multi-contract)
├── ConsoleTest.md                # Console-based contract interaction guide
├── history.txt                   # Deployment/operation history
└── Stacks Repo.txt              # Full Stacks contract source dump
```

---

## 🔑 Deployed Contract Addresses

### Stacks Mainnet (ACTIVE — Consolidated 2-Contract System)

| Contract | Identifier | Role |
|----------|-----------|------|
| **chess-token-v3** | `SP6X0MXEEGZX14ZTK7XQXJ76W35ZJDP9NZBT6F39.chess-token-v3` | SIP-010 token + vault + gateway-release |
| **chess-game** | `SP6X0MXEEGZX14ZTK7XQXJ76W35ZJDP9NZBT6F39.chess-game` | Full game engine (lifecycle, escrow, Elo, timeout) |
| **automata-agent** | `SP6X0MXEEGZX14ZTK7XQXJ76W35ZJDP9NZBT6F39.automata-agent` | AI agent attestation |

> **CRITICAL**: The README.md describes a legacy 7-contract architecture (router, registry, escrow, logic, timer, ranking, token). This has been **superseded** by the consolidated 2-contract system (`chess-token-v3` + `chess-game`). The `contracts/` folder still contains the legacy `.clar` files but only `chess-token-v3.clar`, `chess-game.clar`, and `automata-agent.clar` are active on mainnet.

### Celo Mainnet

| Contract | Address | Role |
|----------|---------|------|
| **ChessToken** | `0xE370aad742dF8DC8Ae9c0F0b9f265334D39e2197` | ERC-20 CHESS token |
| **ChessGame** | `0xf85f00D39A84b5180390548Ea9f76B0458607E78` | Game engine (mirrors chess-game.clar) |

### Deployer / Owner

- **Stacks**: `SP6X0MXEEGZX14ZTK7XQXJ76W35ZJDP9NZBT6F39`
- **Celo**: Deployer wallet stored in `.env` as `PRIVATE_KEY` / `MNEMONIC`

---

## ⚙️ Smart Contract Architecture (Detailed)

### Stacks: `chess-token-v3.clar` (Contract 1 of 2)

**Purpose**: SIP-010 fungible token that also acts as the escrow vault.

| Feature | Detail |
|---------|--------|
| Token Name | Chess Token |
| Symbol | CHESS |
| Decimals | 6 |
| Faucet | 1,000 CHESS per wallet per ~1 day (144 blocks) |
| Vault Pattern | The contract *itself* holds wager tokens — players transfer CHESS to `.chess-token-v3` |
| Gateway Release | `gateway-release(amount, recipient)` — **only callable by `.chess-game-v3`** |
| Mint Control | `mint-enabled` bool, togglable by CONTRACT-OWNER |

**Token Flow (Clarity 4 pattern — no `as-contract` needed)**:
```
DEPOSIT:  Player → ft-transfer? → .chess-token-v3 (vault)
PAYOUT:   chess-game calls chess-token.gateway-release(amount, winner)
          → ft-transfer? runs in chess-token's context
          → can spend .chess-token-v3's own balance natively
```

**Key Functions**:
- `transfer(amount, sender, recipient, memo)` — standard SIP-010
- `faucet-claim()` — anyone claims 1,000 CHESS per day
- `mint(amount, recipient)` — owner only
- `batch-mint(list)` — owner seeds up to 10 recipients
- `gateway-release(amount, recipient)` — **privileged**, only chess-game can call
- `get-vault-balance()` — read the escrow balance

**Error Codes**: u100 (not authorized), u101 (mint disabled), u102 (invalid amount), u105 (faucet cooldown), u106 (same sender)

---

### Stacks: `chess-game.clar` (Contract 2 of 2)

**Purpose**: Complete game engine — lifecycle management, escrow integration, Elo rating, and timeout enforcement.

**Game Status Codes** (mirrors Solidity `GameStatus` enum):
| Code | Name | Meaning |
|------|------|---------|
| u0 | WAITING | Created, waiting for opponent |
| u1 | ACTIVE | Both players joined, in progress |
| u2 | FINISHED | Win/loss result |
| u3 | CANCELLED | Creator cancelled before join |
| u4 | DRAW | Agreed draw |

**Game Storage Map** (`games: uint → {...}`):
```
white:           principal          # Game creator
black:           (optional principal)  # Opponent (none until joined)
wager:           uint               # CHESS tokens wagered (0 = free)
status:          uint               # STATUS-* constant
turn:            principal          # Whose move it is
move-count:      uint               # Total moves made
created-at:      uint               # Block height at creation
last-move-block: uint               # Block height of last move (for timeout)
draw-proposer:   (optional principal)  # Who proposed draw (none if no proposal)
```

**Player Stats Map** (`player-stats: principal → {...}`):
```
wins:         uint
losses:       uint
draws:        uint
rating:       uint    # Elo (starts at 1200)
games-played: uint
```

**Elo Rating System**:
- Starting Elo: 1200
- K-Factor: 32
- Min Rating: 100
- Diff cap: 400
- Formula: Integer approximation of standard expected-score
- Underdog wins → bigger gain; Favorite wins → smaller gain
- Minimum change: 1 point

**Timeout System**:
- Default: 432 blocks (~3 days at 10-min block time)
- Owner-adjustable via `set-timeout-blocks(blocks)`
- Verified on-chain via `block-height` — cannot be faked
- The player whose turn it is gets timed out; their opponent claims the win

**Public Functions (Game Lifecycle)**:
1. `create-game(wager)` → locks white's CHESS, returns game-id
2. `join-game(game-id)` → locks black's matching CHESS, activates game
3. `submit-move(game-id)` → flips turn, increments move-count, resets timeout, clears draw proposal
4. `resign(game-id)` → caller loses, opponent wins (self-harm only)
5. `report-win(game-id)` → caller claims checkmate win
6. `propose-draw(game-id)` → offers draw to opponent
7. `accept-draw(game-id)` → accepts pending draw, both refunded
8. `claim-timeout(game-id)` → claims win if opponent timed out
9. `cancel-game(game-id)` → creator cancels before join, refunded

**Read-Only Functions**:
- `get-game(game-id)`, `get-game-status(game-id)`, `get-current-turn(game-id)`
- `get-total-games()`, `can-claim-timeout(game-id)`, `get-blocks-until-timeout(game-id)`
- `get-player-stats(player)`, `get-rating(player)`

**Error Codes**: u700 (not authorized), u701 (game not found), u702 (not your turn), u703 (invalid opponent), u705 (game not active), u706 (game not waiting), u707 (not your game), u708 (timeout not met), u709 (no draw proposed), u710 (already proposed), u711 (can't accept own), u712 (transfer failed)

**Trust Model**:
- `resign()`: Caller can only hurt themselves
- `claim-timeout()`: Verified on-chain via block height
- `propose/accept-draw()`: Requires both parties
- `report-win()`: Caller claims checkmate — chess rules validated client-side by chess.js. Since CHESS tokens are free, abuse risk is minimal.

---

### Celo: `ChessGame.sol` + `ChessToken.sol`

Mirrors the Stacks contracts exactly. Key differences:
- Uses ERC-20 `safeTransferFrom` instead of Clarity `ft-transfer?`
- Players must call `ChessToken.approve(chessGameAddress, amount)` before wagering
- Uses `block.number` instead of `block-height`
- Timeout default: 360 blocks (~30 min on Celo at 5s blocks)
- Emits Solidity events (GameCreated, MoveMade, GameResigned, etc.)
- Has `GameResult` enum (None, WhiteWins, BlackWins, DrawResult, Cancelled) — not present in Clarity version

---

### `automata-agent.clar`

An on-chain attestation contract for AI agent actions:
- `attest-action(user, plan-hash)` — records a SHA-256 hash of the agent's execution plan
- `get-latest-attestation(user)` — read-only to verify the last attestation
- Stores: `plan-hash`, `timestamp` (block-height), `nonce` (incrementing count)

---

## 🖥️ Frontend Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 16.2.1 | App framework |
| React | 18/19 (peer dep) | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Styling |
| Framer Motion | 12.38.0 | Animations |
| Wagmi | 3.6.2 | EVM wallet integration |
| viem | 2.48.0 | EVM interactions |
| @tanstack/react-query | 5.99.0 | Async state management |
| react-chessboard | 5.10.0 | Visual chessboard (not yet integrated into pages) |
| chess.js | 1.4.0 | Chess rule validation (not yet integrated into pages) |
| @stacks/connect | 8.2.6 | Stacks wallet connection (not yet integrated into provider) |
| @stacks/transactions | 7.4.0 | Stacks transaction signing (not yet integrated) |
| Zustand | 5.0.12 | State management (installed, not yet used) |
| next-themes | 0.4.6 | Theme switching |
| Radix UI | Various | Dialog, dropdown, toast, tooltip primitives |

**Current Frontend State**:
- Landing page only (Hero + Features + CTAFooter)
- Celo wallet connection works (MiniPay-aware custom provider)
- Stacks wallet provider **NOT** implemented yet
- No gameplay UI exists yet
- No chessboard integration yet
- Premium dark theme with purple/gold aesthetic

**Provider Architecture** (`src/app/providers.tsx`):
```
WagmiProvider (Celo chain only)
  └─ QueryClientProvider
       └─ WalletProvider (custom, MiniPay-aware, EVM only)
            └─ {children}
```

**Config** (`src/config/contracts.ts`):
- `CELO_CONTRACTS.token` = `0xE370aad...`
- `CELO_CONTRACTS.game` = `0xf85f00D...`
- `STACKS_CONTRACTS` — references legacy contract names (needs updating)
- `HIRO_API` — auto-switches between mainnet/testnet
- Token constants: 6 decimals, 1000 CHESS faucet, 144 block cooldown

---

## 🧪 Testing Infrastructure

| Tool | Config | Status |
|------|--------|--------|
| Vitest | `vitest.config.ts` | Configured |
| Clarinet SDK | `@stacks/clarinet-sdk@3.9.0` | Installed |
| vitest-environment-clarinet | `3.0.0` | Installed |
| Test Files | `tests/*.test.ts` | **Scaffold only** — all tests are stubs |

**Commands**:
```bash
npm run test          # vitest run
npm run test:report   # vitest with coverage
npm run test:watch    # chokidar watches tests/ and contracts/
```

> **IMPORTANT**: All test files are currently scaffolds (~581 bytes each). No actual test assertions have been written yet.

---

## 🤖 Simulation Scripts

These scripts run automated game lifecycles on mainnet to generate on-chain activity:

### `simulate-celo.cjs` (19.9KB) — Celo Mainnet Simulator
- Manages 15+ simulation wallets
- Auto-handles faucet claims
- Uses `waitForTransactionReceipt` to prevent race conditions
- Decodes hex revert signatures (e.g., `NotYourTurn`, `InsufficientAllowance`)
- Simulates: game creation, join, moves, resign, checkmate (reportWin), agreed draws
- Requires: wallets pre-funded with CELO for gas

### `simulate-stacks.js` (15.5KB) — Stacks Mainnet Simulator
- Similar flow to Celo simulator
- Uses `@stacks/transactions` for contract calls
- `TheQueenGambit.cjs` patches this file (adds retry logic, updates contract references)
- Targets the consolidated `chess-game` contract directly (not the legacy router)

### `distribute-stacks.js` (19.5KB) — STX Distribution
- Resilient to partial failures
- Detects and reuses already-funded hub wallets from previous runs
- Distributes STX gas to simulation wallets

### `icarus.js` (22.9KB) — Advanced Stacks Orchestrator
- Orchestrates complex simulation scenarios

### Supporting Scripts
- `distribute_celo.js` — distributes CELO gas to simulation wallets
- `fetch_celo_balances.js` — reads CELO balances across all wallets
- `simulate-automata.js` — runs automata-agent attestation simulations
- `scripts/generate-stacks-wallets.js` — generates wallet keypairs

---

## ✅ Completed Milestones

### 1. Celo Protocol Core (Solidity) — DONE
- [x] `ChessToken.sol` deployed to Celo Mainnet at `0xE370aad742dF8DC8Ae9c0F0b9f265334D39e2197`
- [x] `ChessGame.sol` deployed to Celo Mainnet at `0xf85f00D39A84b5180390548Ea9f76B0458607E78`
- [x] On-chain Elo rating system (K-factor 32) verified
- [x] Full simulation engine (`simulate-celo.cjs`) running 15+ wallets on mainnet
- [x] Decodes revert signatures, handles faucet cooldowns, synchronizes with receipt polling

### 2. Stacks Protocol Port (Clarity) — DONE
- [x] Consolidated from 7-contract legacy system to 2-contract architecture
- [x] `chess-token-v3.clar` deployed with gateway-release pattern (Clarity 4)
- [x] `chess-game.clar` deployed with full lifecycle, escrow, Elo, and timeout
- [x] Bug sanitization: removed non-ASCII characters, fixed naming conflicts, standardized block-height usage
- [x] Mainnet verification confirmed
- [x] STX distribution script made resilient to partial failures

### 3. Frontend Foundation (Next.js 16) — DONE
- [x] Responsive landing page with Hero, Features, CTAFooter
- [x] Premium dark theme with purple/gold aesthetic, glassmorphism, micro-animations
- [x] Celo (EVM) wallet provider via Wagmi + custom MiniPay detection
- [x] Component library: GlowButton, ClayCard, StatBadge, ThemeToggle
- [x] Environment config standardized (`.env` for keys, `Clarinet.toml` for Stacks dev)

### 4. NPM Package — DONE
- [x] Published `chessify-protocol@0.1.2` to public NPM
- [x] Package exports: `VERSION`, `initProtocol()` (placeholder SDK)
- [x] Bundled with tsup (ESM + DTS)
- [x] Contracts directory included in package

### 5. AI Agent Infrastructure — DONE
- [x] `automata-agent.clar` deployed — on-chain attestation for AI actions
- [x] `simulate-automata.js` simulation script functional

---

## 🚧 Known Issues & Technical Debt

### Critical
1. **`src/config/contracts.ts` references legacy contract names** — `STACKS_CONTRACTS` object still points to `chess-token_v2`, `chess-escrow`, `registry`, `logic`, `timer`, `ranking`, `gateway_v2`. These should be updated to the consolidated `chess-token-v3` and `chess-game` identifiers.
2. **`chess-token-v3.clar` gateway-release references `.chess-game-v3`** (line 121) — verify this matches the actual deployed contract name. The `Clarinet.toml` registers `chess-game` not `chess-game-v3`.
3. **`README.md` documents outdated architecture** — describes the 7-contract system. Needs rewrite to reflect the 2-contract consolidated model.

### Moderate
4. **All unit tests are stubs** — 7 test files exist but contain no assertions. Need actual tests covering token transfer, game lifecycle, Elo calculation, timeout, draw flow.
5. **Stacks wallet not integrated in frontend** — `@stacks/connect` is installed but no `StacksProvider` exists in `providers.tsx` or the component tree.
6. **`src/lib/index.ts` has dead commented-out code** — contains temporal anomaly comments and an abandoned ThemeToggle export.
7. **`src/files/` contains orphaned config files** — `globals.css` and `tailwind.config.ts` appear to be archived duplicates.

### Low
8. **`chess-token.clar` (v1) defines its own SIP-010 trait** — in production, should reference the official trait from the Stacks chain. Same applies to `chess-token-v3.clar`.
9. **No error handling in `wallet-provider.tsx`** for chain mismatch — user could be on wrong EVM chain.
10. **`package.json` repo URL** points to `github.com/jadonamite/Chessify` — verify this is the canonical URL.

---

## 🚀 Roadmap to 1.0 (Ordered by Priority)

### P0 — Stacks Frontend Integration (Blocking)
- [x] **Stacks Wallet Provider**: Integrated `@stacks/connect` into `WalletProvider` to handle Stacks authentication alongside EVM.
- [x] **Dual-Chain Connection**: Implemented network switching logic in `WalletProvider`, integrated into the global `Navbar` in `src/components/landing/Hero.tsx`.
- [x] **Multi-Chain Navbar**: Enhanced navbar with multi-chain state, balance display, and chain toggle.
- [x] **Stacks Contract Hooks**: Created `useStacksChess` hook in `src/hooks/useStacksChess.ts` wrapping `openContractCall` for the full game lifecycle.
- [x] **Update `contracts.ts`**: Replaced legacy `STACKS_CONTRACTS` references with `chess-token-v3` and `chess-game`.

### P1 — Gameplay & Board Integration
- [x] **React Chessboard**: Integrated `react-chessboard` + `chess.js` into a dedicated game page at `src/app/app/game/[id]`.
- [x] **Dual-Chain Move Logic**: Implement `useCeloChess` and unify dispatch logic so the same board works for both chains.
- [x] **Game Hub/Dashboard**: "My Games" page to track active matches, claim timeouts, view past games (History Page).
- [x] **Game Lobby**: Built a dedicated `Lobby` page in `src/app/app/lobby` with challenge creation and network-aware filtering.

- [ ] **On-Chain Move Verification**: Implement lightweight hash-based verification or PGN anchoring to prevent client-side "fake wins".


### P2 — Ecosystem & UX Polish
- [ ] **Cross-Chain Elo Leaderboard**: Merge stats from Solidity `getPlayerStats` and Clarity `get-player-stats` into a unified ranking page
- [ ] **MiniPay Optimization**: Final CSS polish for Celo MiniPay mobile browser — ensure "Launch App" flow is seamless
- [ ] **Wallet Error Handling**: Add chain-mismatch detection, wrong-network warnings, and Stacks/Celo fallback states
- [ ] **SEO & Analytics**: Meta tags, Open Graph, analytics tracking for protocol adoption metrics

### P3 — Testing & Quality
- [ ] **Contract Unit Tests**: Write comprehensive Vitest + Clarinet tests for all game lifecycle paths (create, join, move, resign, timeout, draw, cancel)
- [ ] **Elo Edge Cases**: Test underdog vs. favorite rating changes, minimum-rating floor, draw rating stability
- [ ] **Frontend Integration Tests**: Test wallet connection, contract call flows, error states

### P4 — Future Extensions (Post-1.0)
- [ ] Tournament contract (bracket-based or Swiss)
- [ ] DAO governance for protocol parameters
- [ ] NFT match certificates (proof-of-game as collectible)
- [ ] Spectator rewards
- [ ] ChessFi staking mechanics
- [ ] Leaderboard mining rewards

---

## 🛠️ Infrastructure & Operations

### Development Commands
```bash
npm run dev           # Start Next.js dev server
npm run build         # Next.js production build
npm run build:lib     # Build NPM package (tsup → dist/)
npm run lint          # ESLint
npm run test          # Vitest unit tests
npm run test:watch    # Watch mode for tests + contracts
```

### Simulation Commands
```bash
node simulate-celo.cjs           # Run Celo mainnet simulation
node simulate-stacks.js          # Run Stacks mainnet simulation
node distribute-stacks.js        # Distribute STX gas to wallets
node distribute_celo.js           # Distribute CELO gas to wallets
node fetch_celo_balances.js       # Check wallet balances
node simulate-automata.js         # Run automata attestation sim
node scripts/generate-stacks-wallets.js  # Generate new wallet keypairs
```

### Health Checks
- Verify faucet balances remain sufficient (both chains)
- Monitor gas costs for `submitMove` transactions
- Check `get-total-games()` / `totalGames()` for activity metrics

### Environment Variables (`.env`)
The `.env` file contains sensitive data including:
- Private keys and mnemonics for deployer + simulation wallets
- RPC endpoints
- Contract addresses (also hardcoded in `contracts.ts`)
- Stacks API keys

> **NEVER commit `.env` to version control.** It is listed in `.gitignore`.

---

## 📌 Quick Reference for LLM Agents

### "Where do I find...?"

| What | Where |
|------|-------|
| Active Stacks contracts | `contracts/chess-token-v3.clar` + `contracts/chess-game.clar` |
| Active Celo contracts | `celo-contracts/ChessToken.sol` + `celo-contracts/ChessGame.sol` |
| Frontend pages | `src/app/page.tsx` (landing only) |
| Wallet connection | `src/components/wallet-provider.tsx` (Celo only) |
| Contract addresses | `src/config/contracts.ts` |
| Environment variables | `.env` (root) |
| NPM package entry | `src/lib/index.ts` |
| Unit tests | `tests/*.test.ts` (stubs) |
| Clarinet config | `Clarinet.toml` |

### "What should I NOT do?"

1. **Do NOT use the legacy contracts** (router, registry, escrow, logic, timer, ranking, gateway) — they are superseded by the consolidated `chess-game.clar`
2. **Do NOT reference the README architecture diagram** for current state — it describes the old 7-contract system
3. **Do NOT assume Stacks wallet works** — only Celo EVM wallet is connected in the frontend
4. **Do NOT modify `.env`** without understanding it contains live mainnet keys
5. **Read `node_modules/next/dist/docs/`** before writing any Next.js code — the user's `AGENTS.md` warns about breaking changes in this version

### "What's the contract call pattern?"

**Celo (Solidity/EVM)**:
```
1. Player calls ChessToken.approve(chessGameAddress, wagerAmount)
2. Player calls ChessGame.createGame(wagerAmount)   → locks tokens via safeTransferFrom
3. Opponent calls ChessGame.joinGame(gameId)        → locks matching wager
4. Players alternate ChessGame.submitMove(gameId)   → flips turn, resets timeout
5. Game ends via resign/reportWin/claimTimeout/acceptDraw/cancelGame
6. Winner receives totalPot via safeTransfer
```

**Stacks (Clarity)**:
```
1. Player calls chess-game.create-game(wager)
   → internally: chess-token-v3.transfer(wager, tx-sender, .chess-token-v3, none)
2. Opponent calls chess-game.join-game(game-id)
   → internally: chess-token-v3.transfer(wager, tx-sender, .chess-token-v3, none)
3. Players alternate chess-game.submit-move(game-id) → flips turn, resets timeout
4. Game ends via resign/report-win/claim-timeout/accept-draw/cancel-game
5. Winner receives totalPot via chess-token-v3.gateway-release(amount, winner)
```

---

> [!IMPORTANT]
> **The canonical source of truth for contract architecture is this `progress.md` file and the actual deployed `.clar` / `.sol` files — NOT the README.md, which documents the superseded 7-contract system.**
