# Playchessify — Session Handover ("all we have done")

**Session date:** 2026-06-26 · **Branch:** `main` · **Live:** Celo mainnet (`42220`)
**Companion docs:** `handover.md` (system reference), `DEPLOY.md` (redeploy runbook), `TODO.md` (checklist).

This file is the record of everything changed in this session, what's verified, what still
needs your eyes, and where to resume. Read it top-to-bottom before continuing.

> ⚠️ **One thing gates everything below:** the changes are code-complete and `npm run build`
> passes, but the `/app/*` UI is Privy-gated so it **cannot be headless-verified** from CI/agent.
> The **device-check list** near the end is the real sign-off. Nothing here is "done" until it
> passes on a real device.

---

## 0. TL;DR of the session

We did five blocks of work:

1. **Doc accuracy** — the repo docs claimed the contracts weren't deployed and used stale terms;
   corrected to the live-on-mainnet reality (twice — a second pass fixed signing + cron claims).
2. **Re-enabled auto-deploy** — `vercel.json` had `deploymentEnabled:false`, which is why prod
   was serving pre-2026-06-18 code and testers saw the long-removed per-move signature popups.
3. **Timeout / game-ended correctness** — the relay now freezes a game at the move-clock
   deadline, and the result screen reads the real on-chain outcome on re-entry (fixed a live
   "returning loser sees *You won*" bug).
4. **`.chess` name bug** — diagnosed + fixed the Tier-A dual-identity split (names vanishing on
   leaderboard/search/game). Self-healing alias + identity pinning. Off-chain only.
5. **Faucet black-screen / WebGL** — root-caused to WebGL-context exhaustion; added an error
   boundary, killed the per-element 3D canvases, and gave every page one shared decorative
   background. Removed the stray floating "FAUCET" text.

Plus the **neon UI foundation** (CSS primitives) was laid; the actual screen re-skins are NOT
done and are the main remaining work.

---

## 1. Documentation accuracy (README / DEPLOY / handover / TODO)

**Why:** docs said "oracle contracts not deployed yet" and listed pre-oracle addresses, used
`cUSD` (the chain renamed it USDm), and described the v1 landing — all wrong as of today.

- **README.md** — live-on-mainnet banner + real addresses (ChessToken
  `0x3f7efdfc8a76f76f22512fcd2bddc5fca36e55a3`, ChessGame
  `0xb37877a9ebd6c3169b2eaaa3e16852839785ae85`, operators oracle `0x4d68…C6c9` / minter
  `0x4548…5AB9` / gas-sponsor `0xc26f…D0f2`, owner `0xF679…7638`); `cUSD→USDm`; landing =
  `ChessifyLanding`; move-relay description corrected (turn-bound, signing off, move-clock reject);
  cron = daily.
- **DEPLOY.md** — reframed from "pre-launch blocker" to a **redeploy/rehearsal runbook**; mainnet
  flip marked DONE; `cUSD→USDm`; cron daily; Tier-C rehearsal row; signing-off note.
- **handover.md** — date bumped; new session log; removed two **resolved** gotchas (the
  `contracts.ts` cooldown/block-time note and the dead `lib/index.ts` ThemeToggle block); landing
  reference fixed; gas section rewritten to USDm + Tier C; **signing documented as dormant**;
  **cron documented as daily** (Hobby-plan limit, non-blocking).
- **TODO.md** — date bumped; cleared items moved; signing + cron claims corrected; handover prompt
  refreshed.

---

## 2. `vercel.json` — restored auto-deploy (the actual fire)

`vercel.json` contained `"git": { "deploymentEnabled": false }`, which **disables auto-deploy on
GitHub push**. That's why prod was pinned to a build older than `297f5c4` (2026-06-18) — the commit
that removed per-move signing — so testers were getting a **signature popup on every move** from
stale code. Removed that line; pushes to `main` auto-deploy again.

> Cron in `vercel.json` is `0 0 * * *` (**daily**) — the Vercel **Hobby plan only allows daily
> crons**, not "every minute." This is fine: the relay freezes a decided game (see §3), so on-chain
> settlement latency only delays the payout, never the outcome. Left as-is.

**➡ ACTION FOR JADON:** you said Vercel is logged in — **confirm prod redeployed to current
`main`** (Vercel dashboard "Production" commit, or `vercel ls`). Until it does, none of this
session's fixes reach players.

---

## 3. Timeout / game-ended correctness (tasks #1–#4)

**Problem:** on timeout the UI showed "You won," but the opponent could wander back and **keep
playing** (the move was still accepted), and a player returning to a finished game could see the
**wrong result** ("You won" when they lost).

- **#1 Relay move-clock backstop** — `src/app/api/games/[chain]/[id]/moves/route.ts`: once the
  last recorded move is older than `MOVE_TIMEOUT_MS`, the relay **rejects** any further move
  (`409 "move window expired — game is being settled"`). The returning opponent physically can't
  move; the outcome is frozen off-chain the instant it's decided. (This is the senior fix — the
  relay already gates moves; the clock is just one more allowability rule.)
- **#3 Real result on re-entry** — `src/components/game/types.ts` added `result` to `GameData` +
  `resultForColor()`. `useGameData` now maps the on-chain `result`, derives `chainResult`,
  `gameEnded`, `contractCancelled`. `GameClient` rewired: when `payoutSettled`, the result comes
  from `chainResult` (authoritative) instead of guessing from the board — **fixes the
  returning-loser-sees-"won" bug**. Added `movesTimedOut` (derived from the relay's last-move
  timestamp) so a re-entering player to a timed-out game gets the right win/lose. The relay hook
  was moved above the result derivation so it can read `relayMoves`.
- **#2 / #4 Ended state + eject** — `canAct` already gates interactivity on `contractActive`, and
  the result overlay now shows correctly on re-entry with a back-to-lobby CTA. (No separate
  "game has ended" panel and no auto-redirect were added — the overlay + CTA cover it. If you want
  a dedicated ended screen or auto-return, that's a small follow-up.)

---

## 4. `.chess` name bug — Tier-A dual-identity (task #7) ✅ code-complete

**Symptom:** a saved `.chess` name showed on the user's own profile/settings but **vanished on the
leaderboard, in search, and in live games** — for some users.

**Root cause (single mechanism, code-traced):** a Privy user has **two addresses** — the embedded
EOA (signer) and the smart account (the on-chain player the paymaster sponsors). `playerAddress`
resolved to the smart account *only once the smart-wallet client was ready*, else fell back to the
EOA. So a profile (keyed by `playerAddress` at claim time) and a game (keyed by the on-chain
`msg.sender`) could land under the **two different addresses of the same person**. Casing was never
the issue — everything lowercases consistently; the leaderboard and game always agree (both read
on-chain), so the profile is the odd one out.

**The heal (recovers already-lost names — off-chain, paymaster untouched):**
- `src/lib/profile-store.ts` — added alias key `chess:profile:alias:{addr}`; `getProfileByAddress`
  and `getBatchProfiles` fall back through it (one hop). Added `getProfileDirect` (literal-key
  lookup, used by mutations) and `linkProfileAlias`. `updateProfile` now uses `getProfileDirect`.
- `src/app/api/profile/link/route.ts` (**new**) — one **EOA-signed** request links the pair (the
  EOA owns the smart account, so it authorizes either direction); the server points whichever
  address lacks a profile at the one that has it. Anti-replay + signature-verified.
- `src/hooks/useProfileLink.ts` (**new**) — mounted in `src/app/app/layout.tsx`. Once both
  addresses are known, links them **silently, once per device** (localStorage-guarded).

**The prevention (stops new splits) — `src/components/wallet-provider.tsx`:**
- Identity is **pinned**: an embedded user's `playerAddress` is the **smart account only — never
  the bare EOA**, and is `null` until it resolves (so create/join/claim wait instead of acting
  under the EOA). **8-second timeout fallback** degrades to the EOA so nobody is ever bricked.
- Exposed `identityReady`. `src/hooks/useCeloChess.ts` now **consumes the single pinned identity**
  from context instead of re-deriving it (that drift was the root cause).

**Deferred (task #12):** profile claim/update still signs with the EOA via wagmi (server verifies
via EIP-1271). The alias makes resolution correct regardless; switching to the smart-wallet signer
is a robustness refinement, left out to avoid touching the claim path mid-fix.

**➡ DIAGNOSTIC FOR JADON:** for an affected user, compare which address holds
`chess:profile:addr:*` vs which appears as `white`/`black` on their games — they'll differ (the
person's two addresses). After they next log in, the alias should make the name reappear everywhere.

---

## 5. Decisions logged

- **#6 Dead signing code** — `useMoveSigner` + the relay/settlement `sig` verification are dormant
  (client submits all moves unsigned since `297f5c4`). **Decision: keep dormant** (cheap,
  reversible insurance for a future signed high-stakes mode). Documented in `handover.md`.

---

## 6. Neon UI foundation (task #8) + key finding

- `src/app/globals.css` — appended an additive **neon foundation**: `.neon-panel`,
  `.neon-panel-hover`, `.neon-trapezoid`, `.neon-heading`/`.neon-heading-accent`, `.neon-glow`,
  `.neon-text-cyan`, `.neon-grid-bg`, `.neon-divider`, `.neon-eyebrow`. Built on the **existing**
  tokens (cyan `--c`, navy `--bg`) and **keeps Unbounded** (`--fd`) — inert until a screen opts in.

- **Key finding (re-scoped the re-skin):** reading the code, the inner screens are *more* neon-
  aligned than the marker-count suggested. **History, Leaderboard, Faucet are already hand-rolled
  neon** (their "0 markers" meant they use neither ClayCard nor candy). The candy/clay divergence
  is **concentrated in the lobby**. So the re-skin is smaller and targeted, not "6 screens."
- **"Unbounded" = the literal font** (`--fd`) Jadon is protective of. Keep it as the inner-app
  display font; only layer the landing's Anton/Chakra on headings *if* we choose to, per screen.

---

## 7. Faucet black-screen / WebGL context exhaustion (task #13) ✅ code-complete

**Symptom:** clicking Faucet → black screen; console showed repeated
`THREE.WebGLRenderer: Context Lost` and
`Uncaught TypeError: Cannot read properties of null (reading 'addEventListener') at connect/onCreated`.

**Root cause:** the app mounted **11+ separate `<Canvas>` instances**, each its own WebGL context,
and `PieceView` minted **one context per list/card element**. Browsers cap simultaneous contexts
(~8–16); navigation blew the cap → the browser killed the oldest contexts → a freshly-mounted
Canvas wired events to a dead element → uncaught crash → the whole route unmounted (black screen).
Not caused by this session's other work — pre-existing architecture.

**Context for the fix:** the per-page Canvas split exists deliberately to keep the **landing king
fast to load**. So a full single-`<Canvas>` + drei `<View>` refactor was **rejected** (would risk
that). Jadon's call: drop the per-element 3D, keep decorative backgrounds, add backgrounds to the
pages that lacked them.

- `src/components/ui/SceneBoundary.tsx` (**new**) — error boundary; a lost/failed 3D scene degrades
  to "no background" instead of crashing the page. Wrapped around the faucet/history scenes and
  (originally) `PieceView`.
- **Removed the stray floating 3D "FAUCET"/"CHESS" text** from `FaucetContent`.
- **`PieceView` (3D mini-canvas) → `PieceIcon` (2D SVG sprite)** in `src/components/ui/ChessModels.tsx`
  — used in History rows, Faucet cards, and the promotion picker (now color-correct white/black).
  This removes the per-element context multiplier (the real budget killer).
- `src/components/ui/PageBackground.tsx` (**new**) — one reusable decorative scene (floating
  King/Queen + pieces + grid), single Canvas, `SceneBoundary`-wrapped, **no HDR** (plain lights),
  dpr-capped + low-power. Optional `hero` (`king`/`queen`) and `grid` props.
- **Mounted `PageBackground`** on the four pages that had no 3D background: **lobby** (`grid=false`,
  it has its own), **leaderboard** (queen), **settings**, **profile**. Faucet/history keep their
  existing scenes. Landing king + `LoadingState` left untouched.

**Result:** decorative pieces on every page, ~1 WebGL context alive at a time, the black-screen
can't recur, and a dropped context just loses the background.

---

## 8. New & modified files

**New:**
- `src/hooks/useProfileLink.ts`
- `src/app/api/profile/link/route.ts`
- `src/components/ui/SceneBoundary.tsx`
- `src/components/ui/PageBackground.tsx`
- `allwehavedone.md` (this file)

**Modified:**
- Docs: `README.md`, `DEPLOY.md`, `handover.md`, `TODO.md`
- Config: `vercel.json`, `src/app/globals.css`
- Settlement/relay: `src/app/api/games/[chain]/[id]/moves/route.ts`
- Game flow: `src/components/game/types.ts`, `src/hooks/useGameData.ts`,
  `src/components/game/GameClient.tsx`
- Identity: `src/lib/profile-store.ts`, `src/components/wallet-provider.tsx`,
  `src/hooks/useCeloChess.ts`, `src/app/app/layout.tsx`
- 3D/UI: `src/components/faucet/FaucetContent.tsx`, `src/components/ui/ChessModels.tsx`,
  `src/components/lobby/HistoryContent.tsx`, `src/components/ui/PromotionModal.tsx`,
  `src/components/lobby/LobbyContent.tsx`, `src/components/lobby/LeaderboardContent.tsx`,
  `src/app/app/settings/page.tsx`, `src/app/app/profile/[identifier]/page.tsx`

---

## 9. Verification status

- ✅ `npx tsc --noEmit` — clean.
- ✅ `npm run build` (clean `.next`) — clean, multiple times across the session.
- ❌ **Device / runtime** — NOT done (Privy-gated `/app/*` can't be headless-verified). See below.

---

## 10. ➡ Device-check list (the real sign-off)

Do these on a real device before considering anything shipped:

1. **Deploy** — confirm prod redeployed to current `main` (auto-deploy was just re-enabled).
2. **Names** — log in with a social/email (Tier A) account → open **Leaderboard** → your `.chess`
   name shows. Open a game you played → your name shows. (Tests the alias self-heal.)
3. **Faucet** — open Faucet → loads with its 3D background, **no black screen**, no stray text.
4. **Backgrounds** — glance at **lobby / leaderboard / settings / profile** → hovering pieces read
   well behind the content (check the **lobby** isn't too dim — it has a dark overlay).
5. **Timeout** — let an opponent's clock expire → you see the win; have them try to move → blocked;
   confirm the game doesn't "resume." Re-open a finished game as the loser → shows **You lost**.
6. **No per-move popups** — play a few moves → no signature prompt per move (confirms stale prod
   was the cause).

---

## 11. Open tasks (resume here)

| # | Task | State |
|---|---|---|
| 9 | Re-skin **leaderboard + history** to neon | Light cohesion only — they're already neon. Low priority. |
| 10 | Lobby = intentional **neon + candy + clay hybrid** | ✅ Codified (2026-06-27): `PlayCard` shell (`tone` neon/candy/clay), candy stat semantics (lime=balance, amber=rating, grape=record), clay touches (crown orb tilt-on-hover, selected wager chip). **Keep the playfulness — do NOT flatten to mono-neon.** Needs device review. |
| 11 | Re-skin **faucet + settings + profile** | Mostly already neon; light pass. |
| 12 | Sign profile claim/update with smart wallet (EIP-1271) | Deferred refinement; alias makes it non-urgent. |

**Not in scope / deferred elsewhere:** draw-aware Elo (needs a contract change → bundle with the
July 2026 ERC-2771 forwarder redeploy); Tier-C forwarder itself (July 2026).

---

## 12. Key decisions & gotchas to carry forward

- **Auto-deploy was off** — if prod ever looks stale again, check `vercel.json` /
  `deploymentEnabled` first.
- **Cron is daily** (Hobby limit) and that's OK — the relay freeze makes settlement latency
  non-blocking. Don't "fix" it without a plan/plan upgrade.
- **Per-move signing is OFF** (dormant since 2026-06-18). The "trusted middleman" model is
  intentional. Re-enable only for a signed high-stakes mode.
- **Identity is pinned to the smart account** for embedded users — never reintroduce an EOA
  fallback that runs *before* the smart account resolves (that was the name bug).
- **Keep WebGL contexts low** — use `PageBackground` for decorative 3D and `PieceIcon` (2D) for
  list/card icons. Don't add new per-element `<Canvas>` instances. `SceneBoundary` is the seatbelt.
- **"Unbounded" is the inner-app font** — protect it in any re-skin.
- **The lobby is a deliberate neon+candy+clay hybrid** — the candy/clay isn't off-language, it's
  intentional playfulness Jadon wants kept. Neon = frame/actions, candy = personal stats, clay =
  tactile/pressable moments. Use `PlayCard` for any new lobby surface; never flatten to mono-neon.
- **Auto-commit bot (`Elite.cjs`) is active** — expect this session's work to land under bot commit
  messages automatically.
