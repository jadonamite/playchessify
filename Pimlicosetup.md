# Pimlico Setup — Tier A Gas Sponsorship (Celo Mainnet)

How to finish wiring ERC-4337 smart-wallet sponsorship for Playchessify. Tier A
(`smart` — Privy social/email smart wallets) needs Pimlico as the bundler **and**
paymaster. Tiers B (MiniPay cUSD drip) and C (self-pay) don't use Pimlico.

> **Where Pimlico lives:** entirely in the **Privy dashboard**, not in app code or
> Vercel env (`src/app/providers.tsx:54`). There is nothing to deploy or add to
> Vercel for this. The `PIMLICO_API_KEY` saved to `.env` by the CLI is just your
> reference copy to paste into Privy.

---

## 0. Prerequisite — get the API key

Run from the repo root (opens your browser, log into Pimlico, key is saved to `.env`):

```bash
npx --yes @pimlico/cli@latest --site-name "Playchessify" --origin https://celo.playchessify.xyz --env-path .env
```

Result: `PIMLICO_API_KEY=pim_xxxxxxxx` in `~/Projects/playchessify/.env`.

---

## 1. The Celo endpoint URL

Pimlico's v2 RPC is a **single URL that is both the bundler and the paymaster**.
For **Celo mainnet (chainId 42220)**:

```
https://api.pimlico.io/v2/42220/rpc?apikey=PIMLICO_API_KEY
```

Substitute your real key for `PIMLICO_API_KEY`. You will paste this URL into Privy
in **two** fields (bundler + paymaster) in step 3.

---

## 2. Fund Pimlico + create a sponsorship policy (REQUIRED on mainnet)

Mainnet sponsorship is **paid** — unlike testnet, Pimlico will not sponsor userOps
for free. In the [Pimlico dashboard](https://dashboard.pimlico.io):

1. **Add balance / credits** to your account. This is the pool that actually pays
   players' gas. Start small (e.g. a few dollars of credit) — each sponsored move-
   settlement userOp is cheap on Celo, but it is real money.
2. **Create a Sponsorship Policy** (Sponsorship Policies → Create):
   - **Scope it** to Celo (42220) and ideally to the ChessGame contract
     `0xb37877A9EBD6C3169b2eAAa3E16852839785aE85` so only legit game calls are paid.
   - Set sensible **rate / spend limits** (per-user and global) so a sybil can't
     drain the balance. Tier A is social-login gated, but cap it anyway.
   - Copy the **policy ID** (`sp_xxxx`) — you'll reference it in Privy's paymaster
     context (step 3) if you want the policy enforced.

> Without funded balance, Tier A userOps will fail sponsorship and the app falls
> back per `useCeloChess.ts` (retries once, then surfaces the error). It won't
> crash, but smart-wallet users can't play gaslessly until this is funded.

---

## 3. Wire it into Privy

[Privy dashboard](https://dashboard.privy.io) → your app (matching
`NEXT_PUBLIC_PRIVY_APP_ID`) → **Smart Wallets** / Account Abstraction:

1. **Enable smart wallets** (ERC-4337 / Kernel or Safe — match what the app expects;
   Playchessify uses `@privy-io/react-auth/smart-wallets` with the default account
   type, so leave Privy's default unless you changed it).
2. **Add a chain: Celo (42220).**
3. For Celo, set:
   - **Bundler URL** = `https://api.pimlico.io/v2/42220/rpc?apikey=YOUR_KEY`
   - **Paymaster URL** = `https://api.pimlico.io/v2/42220/rpc?apikey=YOUR_KEY` (same URL)
   - **RPC URL** (if asked) = `https://forno.celo.org`
   - **Paymaster context** (if you made a policy): `{ "sponsorshipPolicyId": "sp_xxxx" }`
4. **Save.**

Sponsorship is then automatic via `SmartWalletsProvider` — no code change.

---

## 4. Verify it works

1. Redeploy so all the mainnet env is live: `vercel --prod`.
2. Log in with **social / email** (Tier A) on the deployed site — this creates a
   Privy embedded EOA + smart account.
3. Confirm the smart account is funded with **0 CELO** and you can still
   `createGame` / make a move — the gas comes from Pimlico, not the user.
4. In the Pimlico dashboard, confirm the userOp appears and the balance ticked down.
5. Play to checkmate; confirm the oracle settles (`ChessGame.settleGame`) and the
   pot pays out.

---

## 5. Operating notes

- **Top-up alerts:** set a low-balance alert in the Pimlico dashboard so Tier A
  doesn't silently break when credit runs out.
- **Key rotation:** if `PIMLICO_API_KEY` leaks, revoke it in the dashboard, generate
  a new one, and update the two Privy URLs. No redeploy needed (dashboard-only).
- **Tiers B/C are independent:** MiniPay (cUSD drip via `/api/gas/sponsor`, funded by
  the gas-sponsor wallet `0xc26f…D0f2`) and self-pay EOAs do **not** touch Pimlico.
  A Pimlico outage only affects social-login smart wallets.
- **Graceful degradation:** `useCeloChess.isSponsorshipError` retries a failed
  sponsored userOp once and does **not** silently switch to the embedded EOA (that
  would change the on-chain player mid-game).
