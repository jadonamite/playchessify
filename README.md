# ♟️ Playchessify

A **free-to-play, on-chain chess protocol on Celo**. Players wager free-to-mint CHESS
tokens on real chess matches, with a premium cyber-industrial UI.

Chess rules are validated **off-chain** (chess.js over a Redis move relay) and the result
is **settled on-chain by a trusted oracle** — the contract escrows wagers and pays out, but
never validates chess itself.

---

## 📐 Architecture

Two Foundry contracts on Celo (`celo-contracts/`):

- **`ChessToken.sol`** — ERC-20 CHESS with a faucet (1,000/day), owner mint, and a `minter`
  role so the server can provision tokens to gasless wallets.
- **`ChessGame.sol`** — lifecycle, wager escrow, Elo, and **oracle settlement**
  (`settleGame`, `onlyOracle`) plus a `reclaimExpired` backstop.

Off-chain services:

- **Move relay** — Upstash Redis. Moves are turn-bound and (for capable wallets) signed.
- **Settlement** — a server oracle replays the move list and calls `settleGame`; a
  **Vercel Cron** (`/api/cron/settle`, every minute) guarantees finished games settle.
- **Gas sponsorship** — MiniPay wallets get a cUSD gas drip + CHESS provision; social/email
  wallets use an ERC-4337 Pimlico paymaster; everything degrades gracefully to self-pay.

See **handover.md** for the full system reference and **DEPLOY.md** for the release runbook.

---

## 🔥 Economic model

CELO/cUSD pay gas only. Wagers use **CHESS**, which is free:

- **Faucet** — 1,000 CHESS per wallet per ~24 h (17,280 Celo blocks).
- **Wagers** — selected before match creation; balance checked on-chain; escrowed in the contract.
- **Payout** — released only on settlement (oracle win/draw, resign, accepted draw, or expiry reclaim).

Zero financial risk — CHESS has no monetary value.

---

## 🎮 Lifecycle

1. **Connect** — Privy (injected/MiniPay, embedded, or social). Auto-redirect to `/app/lobby`.
2. **Create** — pick a wager → approve (large-but-finite allowance) → `createGame`. Repeat games
   skip the approve until the allowance is exhausted.
3. **Join** — from the lobby or by match ID; matching wager is locked.
4. **Play** — moves go to the **relay** (not on-chain). Capable wallets sign each move; MiniPay
   moves are turn-bound. The opponent's board syncs by polling.
5. **Resolve** — checkmate/draw/timeout is replayed and **settled on-chain by the oracle**;
   resign and accepted draws settle directly. The winner receives the pot; draws refund both.

---

## 🗂️ Pages

| Route | Page |
|---|---|
| `/` | Landing |
| `/app/lobby` | Open challenges, create/join, profile stats |
| `/app/game/[id]` | Live board (`id` or `bot` for offline AI) |
| `/app/faucet` | CHESS faucet |
| `/app/history` | Your on-chain games |
| `/app/leaderboard` | On-chain Elo rankings |
| `/app/profile/[identifier]` | `.chess` profile (address or username) |
| `/app/settings` | Sound, board theme, piece set, AI difficulty, hints, profile |

---

## 🛠️ Tech

- **Contracts:** Solidity 0.8.20, OpenZeppelin, Foundry
- **Frontend:** Next.js 16, TypeScript, Tailwind CSS 4, Framer Motion
- **Wallet:** Privy (embedded + social + ERC-4337 smart wallets), Wagmi, Viem
- **Off-chain:** Upstash Redis (relay + profiles), Vercel Cron (settlement)
- **Chess:** chess.js (rules), react-chessboard (UI)
- **State:** Zustand, TanStack Query

---

## 📖 Deployed contracts

> The new oracle contracts are **not deployed yet**; `config/contracts.ts` still defaults to the
> old pre-oracle addresses below. Run **DEPLOY.md**, then point `NEXT_PUBLIC_CELO_TOKEN` /
> `NEXT_PUBLIC_CELO_GAME` at the new addresses.

| Contract | Address (old / pre-oracle) |
| :--- | :--- |
| ChessToken | `0xE370aad742dF8DC8Ae9c0F0b9f265334D39e2197` |
| ChessGame | `0xf85f00D39A84b5180390548Ea9f76B0458607E78` |

---

*"Play for the pride of the chain, stay for the thrill of the move."*
