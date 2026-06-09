# playchessify — TODO

## Wagering UX
- [x] **Option A — large-but-finite approval** (done). `useCeloChess.ts` approves `APPROVAL_ALLOWANCE`
  (1,000,000 CHESS) instead of the exact wager, so repeat games skip the approve tx. First game
  is still approve + create/join; every game after is a single tx until the allowance is exhausted.
- [x] **Gasless / free-to-play — capability-tiered sponsorship** (done, replaces Option B). MiniPay
  can't sign typed data, so EIP-2612 permit was dropped in favour of a dual path:
  - **Tier A (Privy social/smart wallet):** ERC-4337 + Pimlico paymaster sponsors the userOp.
    `SmartWalletsProvider` in `providers.tsx`; `useCeloChess.sendWrite` routes via the smart-wallet
    client. Pimlico bundler/paymaster URLs + `PIMLICO_API_KEY` go in the Privy dashboard.
  - **Tier B (MiniPay):** server `cUSD` gas-drip + server-minted CHESS, legacy tx with
    `feeCurrency = cUSD`. `POST /api/gas/sponsor` (sybil-guarded) + `ChessToken.mintTo` (minter role).
  - **Tier C (external EOA):** user pays.

## Security — wager payout (from payout audit, 2026-06-05)
- [x] **CRITICAL: `reportWin` is unauthenticated.** FIXED. `reportWin` is deleted. The only way to
  declare a winner is `ChessGame.settleGame(gameId, result)`, callable solely by the `oracle`
  (`onlyOracle`). The server (`POST /api/games/celo/:id/settle`) independently replays the Redis
  move list with chess.js, settles only terminal positions, and is idempotent + Redis-locked.
  A losing player calling `settleGame` directly reverts `NotOracle` (proved by
  `test_Settle_RevertsForNonOracle`).
- [x] **Stuck escrow.** FIXED. `reclaimExpired(gameId)` lets either participant recover the escrow
  (split refund) after `EXPIRY_BLOCKS` (~1 day) if the oracle is down — an oracle-independent backstop.

## Deploy / ops (new — oracle settlement release)

> Full runbook now lives in **DEPLOY.md**. Already shipped: the settlement worker
> (`/api/cron/settle`, wired in `vercel.json`, every minute) and the gas-sponsor hardening
> (balance-poll instead of blind sleep, typed `GasStatus`, Tier A/B graceful degradation to
> self-pay). The items below are the remaining release steps.

- [ ] Deploy fresh contracts (Foundry): `forge script script/Deploy.s.sol:Deploy --rpc-url alfajores
  --broadcast --verify`, then point `NEXT_PUBLIC_CELO_TOKEN` / `NEXT_PUBLIC_CELO_GAME` at them.
  Migration note: old free-faucet balances are abandoned (app is pre-launch; everyone starts fresh).
- [ ] Set env (gitignored `.env`): `DEPLOYER_PRIVATE_KEY`, `ORACLE_ADDRESS`/`ORACLE_PRIVATE_KEY`,
  `MINTER_ADDRESS`/`MINTER_PRIVATE_KEY`, `GAS_SPONSOR_PRIVATE_KEY`, `CELOSCAN_API_KEY`,
  `NEXT_PUBLIC_FEE_CURRENCY`, `NEXT_PUBLIC_CELO_NETWORK`. Fund oracle (CELO), gas-sponsor (cUSD+CELO).
- [ ] Configure Pimlico paymaster policy for Celo in the Privy dashboard (Tier A).
- [ ] Run the Alfajores rehearsal matrix (Tier A/B sponsorship, draw/timeout/resign, reclaimExpired,
  exploit-gone + sybil checks) before flipping env to mainnet.
