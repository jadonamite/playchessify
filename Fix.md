# Game Engine Fix Log

Audit + repair of the Chessify game-play stack (chess.js rules, AI bot, PvP relay).

## Audit summary

| Layer | Verdict |
|---|---|
| Chess rule engine (`chess.js`) | Sound — delegated to library |
| Bot AI (`src/lib/chess-engine.ts`) | Functional. Depth-3 alpha-beta minimax, hardcoded as Black. Eval is material + pawn/knight piece-square only — weak but correct. |
| PvP relay (`useGameMoves.ts` + API route) | **Race condition** — stale poll responses can overwrite freshly-committed local moves, causing the player's move to visually vanish for ~2s before the next poll restores it. |

## Fixes

### 1. Monotonic guard in `useGameMoves.ts` ✅
**Bug:** `setMoves((prev) => prev.length === incoming.length ? prev : incoming)` — if a poll started before the local POST resolved, the stale response (with `length = N`) would overwrite the local state (`length = N+1`), reverting the player's just-played move until the next poll cycle.

**Fix:** Make the relay state monotonically non-decreasing. Only accept the polled response if it has at least as many moves as the local state.

```ts
setMoves((prev) => (incoming.length >= prev.length ? incoming : prev))
```

This preserves resync when the relay legitimately has more moves (opponent played), but ignores stale shorter responses. The replay effect's full SAN-equality check in `GameClient.tsx` is the safety net for content divergence.

### 2. Bot move timeout cleanup ✅
**Bug:** `setTimeout` in `executeMove` (bot path) fires 1.2s after a move; if the user navigates away in between, `setGame`/`setMoveHistory` run on an unmounted component (React warning, no crash, but unclean).

**Fix:** Track timeout id in a ref and clear it on unmount.

## Progress

- [x] Audit complete — identified one real race + one minor cleanup
- [x] Fix 1: monotonic guard committed
- [x] Fix 2: bot timeout cleanup committed
- [x] Build verification (`npm run build`)
- [x] Pushed to `origin/main`
