# ♟️ Playchessify

[![Live on Celo Mainnet](https://img.shields.io/badge/Celo%20Mainnet-live-35D07F)](https://celo.playchessify.xyz)

A **free-to-play, on-chain chess protocol on Celo** — **live on Celo mainnet** (`42220`) at
[celo.playchessify.xyz](https://celo.playchessify.xyz). Players wager free-to-mint CHESS
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

- **Move relay** — Upstash Redis. Moves are turn-bound (authenticated by turn/legality/
  participant; per-move signing is currently off). The relay also rejects a move once the
  5-minute move clock is exceeded, so a timeout can't be undone by a returning opponent.
- **Settlement** — a server oracle replays the move list and calls `settleGame`; a
  **Vercel Cron** (`/api/cron/settle`, daily) is the guaranteed-settlement backstop. Latency
  is non-blocking — the relay freezes the game the moment it's decided.
- **Gas sponsorship** — MiniPay wallets get a USDm gas drip + CHESS provision; social/email
  wallets use an ERC-4337 Pimlico paymaster; external EOAs get an interim native-CELO drip;
  everything degrades gracefully to self-pay.

---

## 🔥 Economic model

CELO/USDm pay gas only. Wagers use **CHESS**, which is free:

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

## 📖 Deployed Contracts

### Celo Mainnet (`42220`)

| Contract | Address | Celoscan |
| :--- | :--- | :--- |
| **ChessToken (CHESS)** | `0x607590fC7ba3F17b6B3274fF281528a131E9b015` | [View on Celoscan](https://celoscan.io/address/0x607590fC7ba3F17b6B3274fF281528a131E9b015) |
| **ChessGame (Engine)** | `0xA576321eB523FFb1e5FE568b317F9E7a7374fDdf` | [View on Celoscan](https://celoscan.io/address/0xA576321eB523FFb1e5FE568b317F9E7a7374fDdf) |
| **Forwarder (ERC-2771)** | `0xd29618312668007d1Da3B9eB591B7209E1A06cC5` | [View on Celoscan](https://celoscan.io/address/0xd29618312668007d1Da3B9eB591B7209E1A06cC5) |
| **TournamentRewards (Vault)** | `0xd867C2467c41Ccbe315eF4fFa3B9eBFa0C2D8d24` | [View on Celoscan](https://celoscan.io/address/0xd867C2467c41Ccbe315eF4fFa3B9eBFa0C2D8d24) |
| **USDm (cUSD)** | `0x765DE816845861e75A25fCA122bb6898B8B1282a` | [View on Celoscan](https://celoscan.io/address/0x765DE816845861e75A25fCA122bb6898B8B1282a) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18.18 (Node 20 or 22 LTS recommended)
- npm >= 9

### Installation

```bash
git clone https://github.com/jadonamite/playchessify.git
cd playchessify
npm install --legacy-peer-deps
```

### Environment Configuration

Copy the example environment file and configure the values:

```bash
cp .env.example .env.local
```

### Development Scripts

| Command | Description |
|---|---|
| `npm run dev` | Launch local development server with hot-reload |
| `npm run build` | Build optimized production bundle with type validation |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint across codebase |
| `npm run typecheck` | Validate TypeScript types (`tsc --noEmit`) |
| `npm run verify:tag` | Verify Celo attribution tag on deployed contracts |
| `npm run register:agent` | Register ERC-8004 agent on Celo |

---

*"Play for the pride of the chain, stay for the thrill of the move."*
