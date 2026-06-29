# Playchessify — TODO & Handover

**Updated:** 2026-06-26 · Canonical references: **`handover.md`** (system reference + session
log) and **`DEPLOY.md`** (release runbook). This file is the running checklist + the prompt to
spin up a fresh session.

---

## ▶ Next up (after 2026-06-26)

Priority order for the next session:

1. **UI direction (active)** — lobby is now a codified **neon + candy + clay hybrid** (2026-06-27):
   `PlayCard` shell, candy stat semantics, clay tactile touches; GlowButton CTAs kept trapezoid.
   Keep the playfulness — do not flatten to mono-neon. Remaining: roll light cohesion across
   **leaderboard, history, faucet, settings, profile**. Verify on device (authed `/app/*`
   screenshots render blank headless).
2. **Coach portraits/labels** — in flight on the `worktree-coach-labels-frame` worktree
   (remote branches `feat/coach-portraits-webp`, `worktree-coach-labels-frame`). Land or close.
3. **GameClient refactor — finish the hooks** (optional): extract `useChessEngine` /
   bot-move logic / board-interaction handlers per `game_refactor_plan.md` (deferred as
   behaviour-sensitive on a live component).
4. **Tier C meta-tx forwarder** — **deferred to July 2026.** Only when ready for a contract
   redeploy + escrow migration; the interim CELO-drip covers Tier C in the meantime.
5. **New features** — replay viewer, global player search, recent-profiles feed,
   opponent-join notifications (see Backlog).

### ✅ Cleared since 2026-06-15
- **Push to origin** — done; `main` == `origin/main`, working tree clean (wip/bot commits kept
  as-is, no rebase/squash per decision).
- **Indexed routes in prod** — `/api/leaderboard` + `/api/history?address=` verified live;
  Redis index warmed, subsequent calls delta-only.
- **Landing v2** — `/` now renders `ChessifyLanding`; `/landing-v2` staging route retired.
- **`lib/index.ts` dead ThemeToggle block** — removed.

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
- [x] **Off-chain move relay** (Redis) — turn-bound for all tiers. (Per-move signing was built
  but **disabled 2026-06-18**, `297f5c4`, to kill the per-move popup; `useMoveSigner` is dormant.
  Relay also rejects late moves past the 5-min move clock.) Result overlay, resign signaling.
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
- [x] **Cron settlement worker** `/api/cron/settle` (Vercel cron, **daily** `0 0 * * *` — Hobby-plan
  limit) guarantees finished games settle even if both clients disappear. Non-blocking: the relay
  freezes the game at the move-clock deadline, so the outcome is locked before the sweep runs.

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

### Live on mainnet (chain 42220)
- [x] Oracle contracts deployed: ChessToken `0x3F7e…55A3`, ChessGame `0xb378…aE85`. Oracle
  (`0x4d68…C6c9`) and minter (`0x4548…5AB9`) wired and funded; gas-sponsor (`0xc26f…D0f2`) funded.
- [x] **(2026-06-14) Operator re-wire** — recovered the original operator keys, re-pointed
  `setOracle`/`setMinter` from `0x425B` back to the dedicated wallets `0x4d68`/`0x4548`/`0xc26f`,
  funded them (~5 CELO each), synced Vercel + local + `.env.tacked`. Owner key = `EVM_MASTER`
  in `Scripts/.env`. Full account in `handover.md` session log.
- [x] **(2026-06-15) Removed the temporary `/api/admin/recover` route** (key recovery is done;
  verified `404` in prod).
- [x] Pimlico paymaster configured in Privy dashboard for Celo (Tier A) — funded with $1, no
  sponsorship policy yet (low priority while balance is tiny; add a policy before topping up
  meaningfully — see `Pimlicosetup.md`).
- [x] Faucet routes through the smart wallet for Tier A (Pimlico-sponsored, correct identity);
  USDm-aware cooldown UX with friendly countdown modal.

### Tier C (external EOA wallets) — gasless UX
- [x] **Interim — CELO auto-drip**: when a Tier C wallet has <0.01 CELO, drips 0.005 CELO from
  the gas-sponsor wallet (`GAS_SPONSOR_PRIVATE_KEY`, ~15 CELO on hand) before a write
  (`/api/gas/sponsor` with `tier: 'eoa'`), same sybil guards as the Tier B USDm drip
  (per-address cooldown, daily cap, separate `chess:gas-celo:*` Redis keys). Toast: "Playchessify
  sent you some gas for this transaction — get some CELO of your own for next time." Draws
  straight from the gas-sponsor wallet's existing balance — no reallocation needed; top up later
  by sending CELO to its address (a deposit needs no private key) once it runs low.
- [ ] **July 2026 — proper fix (not this month):** ERC-2771 meta-tx forwarder + `*WithSig`/permit functions on
  ChessGame/ChessToken so Tier C gets true paymaster-style sponsorship (no gas line in their
  wallet at all, same as Tier A). Requires new contract addresses + escrow migration — plan as a
  full redeploy, not a patch.

### Code cleanups (non-blocking)
- [x] `lib/index.ts`: removed the dead commented-out "temporal anomaly" ThemeToggle block
  (now just `VERSION` + `initProtocol`).
- [x] Wire the **draw-offer UI** — `proposeDraw`/`acceptDraw` now exposed in GameClient
  (offer/accept card, sidebar, active games only).
- [x] (2026-06-24) **Code-quality pass** — import hygiene + error handling across `ui/`,
  `game/`, `lib/`, hooks, `api/profile/*`; `getRedis()` / `createTransports()` /
  `getPrivyConfig()` extractions. Behaviour unchanged.

### Backlog
- [x] Leaderboard/history scaling — Redis-indexed (`src/lib/game-index.ts`): cursor + player set +
  per-player game index. New `/api/leaderboard` & `/api/history` routes scan only games created
  since the last sync; hooks (`useLeaderboard`/`useHistory`/`usePlayerHistory`) now fetch them.
  **Needs a deploy to go live in prod.**
- [x] Refactor `GameClient.tsx` (~1,000-line monolith) — done: 1062→554 lines, view + data-sync
  extracted into `src/components/game/*` + `useGameData`. See `game_refactor_plan.md` (deeper
  engine/bot hook extraction left as optional follow-up).
- [ ] Game replay viewer · global player search · recent-profiles feed · opponent-join notifications.
- [ ] (Optional) Fund the xAI team to switch the commit bot from NVIDIA to Grok (env-only change).

---

## 🔥 Streaks & relay — follow-ups (2026-06-29)

- [ ] **Run the repair on game 1487** (locked wager): set `RELAY_ADMIN_SECRET` env + redeploy, then
  `POST /api/admin/relay/repair {"gameId":1487}` (GET first for a dry-run). Sweep-all repair was
  offered but deferred.
- [ ] **Streak rewards (Phase 3, deferred)** — hybrid faucet bonus via `mintTo`. **Prereq:** make
  bot/puzzle streak sources **server-validated** (currently self-attested / unauthenticated) before
  any payout, else streaks are a withdrawal vector.
- [ ] **Puzzles** — when built, record the streak inside the server-side puzzle-validation step
  (don't trust the client); the `/api/profile/streak` endpoint already accepts `source: 'puzzle'`.
- [ ] **Audit the dead `if (!board.move())` guards** — chess.js v1 *throws* on illegal moves, so
  these never hit the `false` branch. Safe today only because `settlement.ts` + the moves route's
  history replay wrap them in try/catch; fix the pattern if you touch them.
- [x] **Relay TOCTOU append race** — closed via atomic Lua `appendMove` (LLEN check + RPUSH).
- [x] **Daily streak system** — spine (atomic store, multiplayer/bot sources, UTC) + earned
  celebration (bot on game-over, PvP on Back-to-Lobby) + once/day 0-streak lobby nudge + 🔥 chips.
- [x] **Leaderboard podium** — rebuilt as a flex stage (no mobile stacking), landing aesthetic.

---

## 📋 Handover prompt — paste into a new chat

> I'm continuing work on **playchessify** at `~/Projects/playchessify` — a Celo-only, free-to-play
> on-chain chess protocol (Next.js 16 + Foundry).
>
> **Read first:** `handover.md` (full system reference), `DEPLOY.md` (release runbook), `TODO.md`
> (this checklist), and `AGENTS.md` (Next.js in this repo has breaking changes — read
> `node_modules/next/dist/docs/` before writing Next code).
>
> **Current state:** **Live on Celo mainnet.** ChessToken `0x3F7e…55A3`, ChessGame `0xb378…aE85`,
> oracle/minter/gas-sponsor wired and funded, Pimlico paymaster configured for Tier A. The
> architecture is: **moves are off-chain** (Redis relay, turn-bound for all tiers — per-move
> signing is built but currently disabled; relay rejects late moves past the 5-min clock) and
> **settled on-chain by a trusted oracle** (`ChessGame.settleGame`,
> `onlyOracle`) — there is **no** on-chain `submitMove`/`reportWin`. `.chess` names are off-chain
> Upstash (no contract — do not build one without an explicit design session). Gas is tiered
> (Pimlico paymaster / USDm drip / Tier C native-CELO drip / self-pay). Landing is `ChessifyLanding`
> (v2) at `/`. We're mid-discussion on the **next UI direction** — the mobile makeover covered
> lobby + game; leaderboard/history/faucet/settings/profile still need it.
>
> **⚠️ Open item:** Tier C (external EOA wallets like MetaMask) get **no gas sponsorship** — if
> they connect with 0 CELO they're stuck. Interim fix (CELO auto-drip, same pattern as the Tier B
> USDm drip) and the proper July fix (ERC-2771 meta-tx forwarder + contract redeploy) are both
> scoped under "Tier C gasless UX" above.
>
> **Also know:** this repo is auto-committed every 1–7 min by `~/Projects/Scripts/Elite.cjs` (now
> NVIDIA-powered), so expect frequent commits; today's work is already committed under bot messages.
> Preferences: prioritise brevity, no Co-Authored-By trailer in commits, do exactly what's asked.
>
> Start by reading `handover.md` and the "Tier C gasless UX" section of this file.
