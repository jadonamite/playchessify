# Bugs & Rewrite Candidates

Audit of the live tree (`main` @ `6bb3f06d`, 2026-07-15). Ranked by severity: #1 is a
live integrity hole, the rest are structural.

---

## 1. Move authentication is spoofable — `useMoveSigner` is dead code

**Severity:** critical — decides real payouts.

`src/hooks/useMoveSigner.ts` has zero importers. Commit `297f5c43` ("remove per-move
wallet signature popup in PVP games") dropped the `sign` argument from the call site
and left the hook orphaned.

- `GameClient.tsx:366` calls `relaySubmitMove(move.san, player, next.fen())` — no signer.
- `useGameMoves.submitMove` therefore never sets `sig`.
- The server's verification branch (`app/api/games/[chain]/[id]/moves/route.ts:151-159`)
  is unreachable.

The only authentication left on `POST /api/games/celo/:id/moves` is:

```ts
if (player.toLowerCase() !== sideToMove.toLowerCase())
  return NextResponse.json({ error: 'not your turn' }, { status: 403 })
```

`player` is a string in the request body. Anyone with a game ID can post moves as
either player. Because `settleGameById` replays the relay to decide the winner, this
decides who takes the pot.

`.claude/context.md` lists "signed moves" as shipped. It is not wired.

**Rewrite:** session-token auth instead of per-move signatures. One SIWE-style
signature at game entry; server issues an HttpOnly cookie bound to the address; every
move POST authenticates off the cookie. Keeps the no-popup UX that `297f5c43` wanted
and restores real authentication. `useMoveSigner` becomes the one-time session signer.

---

## 2. `GameClient` is a 702-line god component

Result derivation runs in the render body (lines 168-193). Eight `useEffect`s. Five
refs (`moveHistoryRef`, `soundOnRef`, `aiDepthRef`, `streakFiredRef`,
`settleRequestedRef`) exist only to dodge dependency loops — the comment at line 64
says so outright. Bot logic, PvP relay, turn clock, streak recording and auto-settle
are interleaved behind `isBotGame` ternaries.

**Rewrite:** split by mode — `useBotGame` / `usePvpGame` behind one interface. Extract
`useTurnClock`, `useGameResult` (pure derivation from `gameData` + board + flags) and
`useBotOpponent`. Most refs disappear once state ownership is explicit.

---

## 3. Board state is stored twice

`game: Chess` and `moveHistory: string[]` are separate `useState`s, hand-synced in
three places: `executeMove`, the relay rebuild effect, and the bot reply. chess.js
already tracks history. The rebuild effect compares SAN arrays element-by-element just
to decide whether to `setState`.

**Rewrite:** relay move list becomes the single source of truth; derive `Chess` via
`useMemo` plus one optimistic local move. The comparison effect and `moveHistoryRef`
both go away.

---

## 4. `useLobby` does 10 serial RPC calls and can hide real players

`hooks/useLobby.ts:37` awaits `getGame` one ID at a time from `nonce-1` down to
`nonce-10` — ten sequential round trips every 30s, per connected client.

- With 12 bots creating on-chain lobbies (`lib/bots/actions.ts:94`), a human's open
  lobby is pushed out of that 10-ID window quickly.
- `lib/game-index.ts` already maintains a Redis index this ignores.
- Line 48 hardcodes `/1e6` where every other call site uses `TOKEN_DECIMALS`.

**Rewrite:** server route serving open lobbies off the existing index — one client
fetch. Failing that, `multicall` the batch.

---

## 5. Refreshing the lobby flashes the landing page

`LobbyContent.tsx:194` redirects on `!isConnected`, but
`isConnected = (ready && authenticated) || ...` (`wallet-provider.tsx:73`) is false
while Privy is still resolving. Refreshing `/app/lobby` bounces to `/`, then
`ChessifyLanding.tsx:264` bounces back. Self-correcting, so it's a flicker rather than
a lockout.

**Fix:** `wallet-provider` must expose Privy's raw `ready` as a distinct
`authResolved` flag and gate the redirect on that. Gating on the existing `isReady`
does not work — it's `isConnected && playerAddress && identityReady`, so it would
never redirect a genuinely logged-out user.

---

## 6. `useCeloChess` — 593 lines, four jobs

Gas provisioning, meta-tx forwarding, ERC20 approvals and game calls in one hook.
`ensureGasSponsored` has two near-identical branches (USDm vs CELO) duplicating
read/drip/poll logic. `FORWARDER_CONFIGURED` is a module-level const evaluated at
import.

**Rewrite:** a `gasRail` module exposing `{ ensureGas, send }` per tier
(`smart` | `minipay` | `eoa`); `useCeloChess` shrinks to game calls.

---

## 7. `LobbyContent` mirrors query data into state

Lines 68-113: `balance`, `rating`, `wins`, `losses`, `draws` are five `useState`s
populated from wagmi query results through an effect. These are derived values, not
state.
