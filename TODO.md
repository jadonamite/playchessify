# playchessify — TODO

## Wagering UX
- [x] **Option A — large-but-finite approval** (done). `useCeloChess.ts` approves `APPROVAL_ALLOWANCE`
  (1,000,000 CHESS) instead of the exact wager, so repeat games skip the approve tx. First game
  is still approve + create/join; every game after is a single tx until the allowance is exhausted.
- [ ] **Option B — EIP-2612 permit (gasless approve, always 1 tx)**. Tracker id `53a28f`.
  - Redeploy `ChessToken` extending OpenZeppelin `ERC20Permit` (token currently has no permit).
  - Add `createGameWithPermit` / `joinGameWithPermit(gameId, deadline, v, r, s)` to `ChessGame`
    that call `token.permit(...)` then `safeTransferFrom` in one tx.
  - Frontend: replace the approve tx with an off-chain `eth_signTypedData_v4` permit signature.
  - Verify MiniPay supports typed-data signing for the permit flow.

## Security — wager payout (from payout audit, 2026-06-05)
- [ ] **CRITICAL: `reportWin` is unauthenticated.** Either player in an Active game can call it and
  take the full 2× pot with no proof of actually winning — a losing player can steal the pot by
  calling `reportWin` first (directly, bypassing the UI). On-chain "winner" = whoever calls first,
  not who won. Mitigation options: server-signed (EIP-712) result that `reportWin` verifies, an
  optimistic dispute window, or the PGN-hash anchoring already tracked (id `56481768`).
- [ ] **Stuck escrow.** If both players abandon an Active wagered game and nobody calls
  `claimTimeout`, the pot is locked forever (no rescue path). Consider an owner-rescue or
  auto-expiry for long-dead games.
