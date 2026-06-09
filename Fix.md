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

### 3. Pawn promotion UI ✅
**Gap:** `executeMove` hardcoded `promotion: 'q'`, so under-promotion (rook/bishop/knight) was impossible — a real feature gap, not just polish. Knight promotion in particular is sometimes the only winning move.

**Fix:**
- New `src/components/ui/PromotionModal.tsx` — a centered modal styled to match the project aesthetic (`ClayCard` glass, accent glow, 3D `PieceView` previews of each option).
- `executeMove` now detects promotion moves via `chess.js`'s verbose move list and defers application until the user picks a piece.
- Modal supports keyboard shortcuts (Q / R / B / N) plus Escape to cancel.
- Color of the rendered preview pieces matches the side that's promoting.
- Cancel reverts cleanly — no move is applied, board stays at the pre-move position (because `executeMove` returns true to satisfy react-chessboard's drop handler but only applies state once a piece is selected).

### 4. Stronger bot evaluation ✅
**Gap:** The original bot only scored pawn/knight piece-square positions; bishops, rooks, queens, and the king were material-only. No move ordering, so alpha-beta pruning was less effective than it could be at depth 3 — the bot would routinely hang pieces and miss simple tactics.

**Fix (`src/lib/chess-engine.ts`):**
- Added piece-square tables for **bishop, rook, queen, and king** (middlegame) alongside the existing pawn/knight tables. Tables mirror correctly for Black.
- Switched piece values to standard centipawn scale (`p=100, n=320, b=330, r=500, q=900, k=20000`) so material outweighs positional bonuses correctly.
- Added **MVV-LVA move ordering** (`orderMoves` / `scoreMove`): captures of high-value victims by low-value attackers first, then promotions, en passant, checks, mates. Better ordering = more cutoffs = stronger play at the same depth.
- `evaluateBoard` now short-circuits on terminal states (checkmate → ±∞, draw/stalemate/threefold → 0) so the search prefers/avoids them correctly.
- `minimax` now stops at `game.isGameOver()` in addition to depth 0, avoiding wasted recursion past terminal nodes.

Bonus: also fixed a sign-flip I almost introduced — the minimizing branch must recurse with `isMaximizingPlayer=true`, not `false`. Caught and corrected in the same change.

### 5. Pre-existing TS warnings cleaned ✅
Out-of-scope on the first pass; cleared now so the project type-checks cleanly end-to-end.

- `lobby/HistoryContent.tsx` — dropped unused `MeshDistortMaterial` import and the unused `useWallet()` destructure.
- `lobby/LobbyContent.tsx` — dropped unused `Suspense` and `useMemo` imports.
- `ui/ChessModels.tsx` — `BasePiece` now actually consumes its `emissive` and `emissiveIntensity` props (they were being silently ignored, so modal accents like the red CheckScene glow weren't reaching the material).
- `ui/GameStatusModal.tsx` — removed dead `GlowButton` import and the never-injected `KEYFRAMES` string.

## Progress

- [x] Audit complete
- [x] Fix 1: monotonic guard
- [x] Fix 2: bot timeout cleanup
- [x] Fix 3: pawn promotion modal + under-promotion support
- [x] Fix 4: stronger bot eval (full PSTs, centipawn values, MVV-LVA ordering, terminal short-circuit)
- [x] Fix 5: TS warnings cleared — `tsc --noEmit` is now silent across the whole project
- [x] Pushed to `origin/main`
