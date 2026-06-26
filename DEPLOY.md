# Playchessify — Deploy & Release Runbook

> **Status: LIVE on Celo mainnet (`42220`) since 2026-06-14.**
> ChessToken `0x3f7e…55a3`, ChessGame `0xb378…aE85`; oracle/minter/gas-sponsor wired and
> funded. This runbook is no longer the pre-launch blocker — keep it as the procedure for a
> **redeploy** (e.g. the July 2026 ERC-2771 forwarder, which needs new addresses + escrow
> migration) or an Alfajores rehearsal. The current live addresses are in **handover.md**.

The frontend reads contract addresses from `NEXT_PUBLIC_CELO_TOKEN` / `NEXT_PUBLIC_CELO_GAME`;
`src/config/contracts.ts` still *defaults* to the old pre-oracle addresses for safety, so the
live values come from env. A redeploy means: deploy the new contracts, wire the server keys,
rehearse on Alfajores, then repoint env at the new addresses.

> Source of truth: `celo-contracts/script/Deploy.s.sol`, `celo-contracts/foundry.toml`,
> `src/lib/celo-server.ts`, `vercel.json`. Keep this file in sync with those.

---

## 0. Wallets & keys

Four roles. Each is a plain EOA holding **CELO** so its own txs pay gas natively.

| Role | Env (server / deploy) | What it does |
|---|---|---|
| Deployer / owner | `DEPLOYER_PRIVATE_KEY` | deploys + owns both contracts; sets oracle + minter |
| Oracle | `ORACLE_PRIVATE_KEY` (server) + `ORACLE_ADDRESS` (deploy) | calls `settleGame` |
| Minter | `MINTER_PRIVATE_KEY` (server) + `MINTER_ADDRESS` (deploy) | calls `token.mintTo` |
| Gas sponsor | `GAS_SPONSOR_PRIVATE_KEY` (server) | drips USDm to 0-balance MiniPay EOAs + native CELO to Tier C EOAs |

In production these are **three dedicated single-purpose wallets** (not the shared `Scripts`
pool) so the hot oracle/minter keys are isolated and rotatable: oracle `0x4d68…C6c9`, minter
`0x4548…5AB9`, gas-sponsor `0xc26f…D0f2`. Owner/deployer = `0xF679…7638` (= `EVM_MASTER` in
`Scripts/.env`). The oracle is a low-value hot key — rotatable any time via
`ChessGame.setOracle(newOracle)` from the owner. **Fund:** oracle + minter + deployer with
CELO; gas-sponsor with **USDm *and* CELO** (CELO covers both its own gas and the Tier C drip).

---

## 1. Deploy the contracts (Foundry)

Deploy order is enforced by `Deploy.s.sol`: ChessToken → ChessGame(token) →
`game.setOracle(ORACLE_ADDRESS)` → `token.setMinter(MINTER_ADDRESS)`. Owner = deployer, no
ownership transfer.

```bash
cd celo-contracts

# Required env (gitignored .env or shell):
#   DEPLOYER_PRIVATE_KEY, ORACLE_ADDRESS, MINTER_ADDRESS, CELOSCAN_API_KEY

# Rehearsal — Alfajores
forge script script/Deploy.s.sol:Deploy --rpc-url alfajores --broadcast --verify

# Production — Celo mainnet
forge script script/Deploy.s.sol:Deploy --rpc-url celo --broadcast --verify
```

The script logs `ChessToken`, `ChessGame`, `Oracle`, `Minter`. Record the two contract
addresses. RPC endpoints + Celoscan verification are configured in `foundry.toml`.

Run the test suite first — it covers settle (win/draw/non-oracle/double/invalid), reclaim
windows, resign/draw/cancel, faucet/minter, and Elo:

```bash
forge test -vvv
```

---

## 2. Wire env

**Frontend / Vercel** (point the app at the freshly deployed contracts):

```bash
NEXT_PUBLIC_CELO_TOKEN=<new ChessToken>
NEXT_PUBLIC_CELO_GAME=<new ChessGame>
NEXT_PUBLIC_CELO_NETWORK=alfajores      # 'alfajores' for rehearsal; unset / other = mainnet
NEXT_PUBLIC_PRIVY_APP_ID=<...>
NEXT_PUBLIC_FEE_CURRENCY=<optional USDm fee-currency override>
```

**Server** (gitignored):

```bash
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
ORACLE_PRIVATE_KEY, MINTER_PRIVATE_KEY, GAS_SPONSOR_PRIVATE_KEY
CRON_SECRET            # Vercel Cron sends this as Bearer to /api/cron/settle
```

> `ORACLE_ADDRESS` (deploy) and the address derived from `ORACLE_PRIVATE_KEY` (server) **must
> match** — likewise minter. If they drift, settlement/minting will revert `NotOracle`/`NotMinter`.

**Privy dashboard (Tier A smart wallets):** set the Celo custom-chain config — forno RPC +
Pimlico bundler/paymaster URLs + `PIMLICO_API_KEY`. Sponsorship is then automatic via
`SmartWalletsProvider`.

**Cron:** `vercel.json` already registers `/api/cron/settle` at `* * * * *` (every minute). No
action beyond deploying to Vercel with `CRON_SECRET` set.

---

## 3. Alfajores rehearsal matrix

Run before flipping env to mainnet. Settlement + gas both depend on the relay and the oracle,
so exercise the full path, not just the contracts.

- **Tier A (social/email):** create → play → checkmate → confirm Pimlico-sponsored userOps and
  oracle settlement; confirm signed moves verify (EIP-1271).
- **Tier B (MiniPay):** 0-balance wallet → `/api/gas/sponsor` drips USDm + mints CHESS → create/join;
  then exhaust the sponsor wallet and confirm graceful degradation to self-pay (clear USDm message).
- **Tier C (external EOA):** interim native-CELO auto-drip (`tier: 'eoa'`, same sybil guards) →
  create/join; then degradation to self-pay when the sponsor can't cover.
- **Endings:** checkmate (white/black), stalemate/insufficient-material/3-fold draw, **5-min timeout**
  forfeit, resign, accepted draw — each settles correctly and pays/refunds.
- **Backstop:** let a game pass `EXPIRY_BLOCKS` with the oracle off; confirm `reclaimExpired`
  split-refunds and `canReclaim` flips.
- **Settlement worker:** close both tabs at a terminal position; confirm `/api/cron/settle`
  finalizes within a minute. Confirm idempotency (double-settle is a no-op).
- **Security:** confirm a losing player calling `settleGame` directly reverts `NotOracle`; confirm
  a forged move signature is rejected at relay-write and at settlement; confirm sybil guards
  (cooldown / lock / daily cap) on `/api/gas/sponsor`.

---

## 4. Mainnet flip — DONE (2026-06-14), kept as the redeploy checklist

The initial mainnet flip is complete (live addresses above). Re-run this list for any future
redeploy:

1. Deploy contracts to mainnet (step 1, `--rpc-url celo`).
2. Update Vercel env to the new mainnet addresses; unset `NEXT_PUBLIC_CELO_NETWORK` (or set to
   anything other than `alfajores`). Sync `.env.local` / `.env.production` / `.env.tacked`.
3. Fund oracle/minter (CELO) and gas-sponsor (USDm + CELO) on mainnet.
4. Configure the Pimlico mainnet paymaster policy in Privy.
5. Smoke-test one wagered game end-to-end, then announce.

> **Migration note:** a redeploy abandons balances/escrow on the previous contracts. The first
> launch started everyone fresh; a future redeploy (e.g. the ERC-2771 forwarder) needs an
> explicit escrow-migration plan, not just an env repoint — there may be live games in flight.
