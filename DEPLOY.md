# Playchessify — Deploy & Release Runbook

The blocking work before launch. The frontend is built for the oracle contracts in
`celo-contracts/`, but those are **not deployed**, and `src/config/contracts.ts` still
defaults to the old pre-oracle addresses. This runbook deploys the new contracts, wires the
server keys, and rehearses on Alfajores before flipping to mainnet.

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
| Gas sponsor | `GAS_SPONSOR_PRIVATE_KEY` (server) | drips cUSD to 0-balance MiniPay EOAs |

They may share one key initially, but separate keys are preferred for rotation. The oracle is a
low-value hot key — rotatable any time via `ChessGame.setOracle(newOracle)` from the owner.
**Fund:** oracle + minter + deployer with CELO; gas-sponsor with **cUSD *and* CELO**.

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
NEXT_PUBLIC_FEE_CURRENCY=<optional cUSD override>
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
- **Tier B (MiniPay):** 0-balance wallet → `/api/gas/sponsor` drips cUSD + mints CHESS → create/join;
  then exhaust the sponsor wallet and confirm graceful degradation to self-pay (clear cUSD message).
- **Tier C (external EOA):** self-pay path.
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

## 4. Mainnet flip

1. Deploy contracts to mainnet (step 1, `--rpc-url celo`).
2. Update Vercel env to the mainnet addresses; unset `NEXT_PUBLIC_CELO_NETWORK` (or set to
   anything other than `alfajores`).
3. Fund oracle/minter (CELO) and gas-sponsor (cUSD + CELO) on mainnet.
4. Configure the Pimlico mainnet paymaster policy in Privy.
5. Smoke-test one wagered game end-to-end, then announce.

> **Migration note:** old free-faucet balances on the pre-oracle contracts are abandoned. The app
> is pre-launch — everyone starts fresh on the new deployment.
