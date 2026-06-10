# Playchessify — TODO & Handover

**Updated:** 2026-06-10 · Canonical references: **`handover.md`** (system reference) and
**`DEPLOY.md`** (release runbook). This file is the running checklist + the prompt to spin up
a fresh session.

---

## ✅ Completed (since ~2026-05-17)

### Chain & architecture
- [x] **Went Celo-only** — removed the entire Stacks/Stellar/Soroban/Clarity layer, Clarinet
  toolchain, `useStacksChess`/`useStacksRead`, and all multi-chain branching in wallet/lobby/
  game/history/faucet.
- [x] Purged remaining Stacks references from docs, `tsconfig.json`, `.vscode/tasks.json`, and
  assets (this session).

### Auth & wallets
- [x] **Migrated Reown + Web3Auth → Privy** (embedded wallets + social login + ERC-4337 smart
  wallets) across providers, wallet-provider, wagmi config.
- [x] **Three capability tiers**: `minipay` (cUSD gas drip), `smart` (Pimlico paymaster),
  `eoa` (self-pay); `playerAddress` resolves to the smart-account for Tier A.
- [x] MiniPay auto-connect via injected connector; SSR/prerender + wallet-gating fixes.

### `.chess` identity (off-chain Upstash — no contract)
- [x] Profile types, Redis store, all `/api/profile/*` routes, sig-based auth (5-min replay
  window, rate limits), 30-day username lock, OG-badge (first 100).
- [x] Deterministic SVG avatars, `ChessName`/`ChessAvatar`, `ClaimModal`, profile pages,
  onboarding banner; integrated across lobby/leaderboard/history/game/navbar.

### Gameplay
- [x] **Off-chain move relay** (Redis) — turn-bound + per-move wallet signatures (Tier A/C);
  MiniPay unsigned. Result overlay, resign signaling, 5-min turn clock.
- [x] Stronger bot (full piece-square tables, MVV-LVA ordering), pawn-promotion UI with
  under-promotion, relay stale-poll race fix, captured-piece trays.
- [x] Settings: board themes, **piece sets**, **AI difficulty**, **move hints**.
- [x] Lofi audio (two MP3 tracks + Web Audio move SFX), music toggle.
- [x] ELO leaderboard (podium + pagination), history with WIN/LOSS/DRAW badges.

### Security & settlement — the headline work (committed 2026-06-08; audit 06-05)
- [x] **CRITICAL fix:** deleted the unauthenticated `reportWin`. The only winner-declaring path
  is now `ChessGame.settleGame(gameId, result)`, callable solely by the **oracle** (`onlyOracle`).
- [x] Server (`settle-game.ts` + `celo-server.ts`) independently replays the Redis move list with
  chess.js, **re-verifies every signed move**, settles only terminal positions; idempotent +
  Redis-locked.
- [x] **`reclaimExpired`** backstop — either player split-refunds escrow after `EXPIRY_BLOCKS`
  (~1 day) if the oracle is down. `setOracle` for rotation.
- [x] **Cron settlement worker** `/api/cron/settle` (Vercel cron, every minute) guarantees
  finished games settle even if both clients disappear.

### Gas sponsorship
- [x] Tier A (Pimlico paymaster), Tier B (cUSD drip + `mintTo` CHESS provision, sybil-guarded),
  Tier C (self-pay). Balance-poll instead of blind sleep; **graceful degradation** to self-pay
  with a clear actionable message.

### Contracts & verification
- [x] Foundry project `celo-contracts/` — `ChessToken`, `ChessGame`, `Deploy.s.sol`, **32 tests**
  (settle/non-oracle/double-settle/reclaim/Elo/faucet/minter).
- [x] Verified this session: `tsc --noEmit` clean · `npm run build` clean (all 11 API routes) ·
  `forge test` **32/32 pass**.

### Docs & tooling (this session, 2026-06-10)
- [x] Rewrote `handover.md` + `README.md` to current state; added `DEPLOY.md` runbook.
- [x] Marked/retired legacy docs (`progress.md`, `game_refactor_plan.md` flagged; `ConsoleTest.md`
  + `progress.md` removed as Stacks-era).
- [x] **Upgraded the auto-commit bot** (`~/Projects/Scripts/Elite.cjs`): NVIDIA NIM-generated
  conventional-commit messages with a deterministic fallback, shell-injection-safe commits, keys
  in gitignored `Scripts/.env`. Live across all 6 repos.

---

## 🔜 Next / In progress

### Release — BLOCKING (full steps in `DEPLOY.md`)
> The oracle contracts are **not deployed**; `config/contracts.ts` still defaults to the old
> pre-oracle addresses (`0xE370…` / `0xf85f…`). Nothing works end-to-end until this is done.
- [ ] Deploy fresh contracts to **Alfajores**: `forge script script/Deploy.s.sol:Deploy --rpc-url alfajores --broadcast --verify`.
- [ ] Set env: `DEPLOYER/ORACLE/MINTER/GAS_SPONSOR` keys, `CRON_SECRET`, and point
  `NEXT_PUBLIC_CELO_TOKEN`/`NEXT_PUBLIC_CELO_GAME` at the new addresses. Fund oracle/minter (CELO),
  gas-sponsor (cUSD + CELO).
- [ ] Configure Pimlico paymaster policy for Celo in the Privy dashboard (Tier A).
- [ ] Run the **Alfajores rehearsal matrix** (Tier A/B/C, checkmate/draw/timeout/resign,
  `reclaimExpired`, cron settle, sybil + forged-signature checks).
- [ ] **Mainnet flip** — redeploy, update env to mainnet addresses, smoke-test one wagered game.

### Code cleanups (non-blocking)
- [ ] `config/contracts.ts`: stale `FAUCET_COOLDOWN = 144` / `BLOCK_TIME_SECS = 600` (10-min-block
  assumption; Celo is 5 s / 17,280-block cooldown). Display-only but wrong.
- [ ] `lib/index.ts`: remove dead commented-out "temporal anomaly" ThemeToggle block.
- [ ] Wire the **draw-offer UI** — `proposeDraw`/`acceptDraw` exist on-chain but GameClient only
  exposes resign.

### Backlog
- [ ] Leaderboard/history scaling — currently full `gameNonce` multicall scans; add a cursor or
  Redis index as games grow.
- [ ] Refactor `GameClient.tsx` (~1,000-line monolith) — see `game_refactor_plan.md`.
- [ ] Game replay viewer · global player search · recent-profiles feed · opponent-join notifications.
- [ ] (Optional) Fund the xAI team to switch the commit bot from NVIDIA to Grok (env-only change).

---

## 📋 Handover prompt — paste into a new chat

> I'm continuing work on **playchessify** at `~/Projects/playchessify` — a Celo-only, free-to-play
> on-chain chess protocol (Next.js 16 + Foundry).
>
> **Read first:** `handover.md` (full system reference), `DEPLOY.md` (release runbook), `TODO.md`
> (this checklist), and `AGENTS.md` (Next.js in this repo has breaking changes — read
> `node_modules/next/dist/docs/` before writing Next code).
>
> **Current state:** Frontend + contracts are feature-complete and verified (`tsc` clean,
> `npm run build` clean, `forge test` 32/32). The architecture is: **moves are off-chain** (Redis
> relay, turn-bound + per-move wallet signatures; MiniPay unsigned) and **settled on-chain by a
> trusted oracle** (`ChessGame.settleGame`, `onlyOracle`) — there is **no** on-chain
> `submitMove`/`reportWin`. `.chess` names are off-chain Upstash (no contract — do not build one
> without an explicit design session). Gas is tiered (Pimlico paymaster / cUSD drip / self-pay).
>
> **⚠️ The blocking task:** the oracle contracts in `celo-contracts/` are **NOT deployed** —
> `config/contracts.ts` still defaults to the old pre-oracle addresses (`0xE370…` / `0xf85f…`),
> so nothing works end-to-end until deploy. Next step is the Alfajores deploy + rehearsal matrix
> in `DEPLOY.md`, then the mainnet flip. This needs my private keys + funded oracle/minter/
> gas-sponsor wallets, so it's interactive — help me prep and walk it.
>
> **Also know:** this repo is auto-committed every 1–7 min by `~/Projects/Scripts/Elite.cjs` (now
> NVIDIA-powered), so expect frequent commits; today's work is already committed under bot messages.
> Preferences: prioritise brevity, no Co-Authored-By trailer in commits, do exactly what's asked.
>
> Start by reading `handover.md` and `DEPLOY.md`, confirm the deploy preconditions, then propose
> the Alfajores deploy plan.
