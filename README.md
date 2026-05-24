# ♟️ Chessify Protocol

A **live, mainnet, free-to-play chess protocol** deployed on **Celo (EVM)**.

Players wager free-to-mint CHESS tokens on fully on-chain chess matches, with a premium Cyber-Industrial UI.

---

## 📐 Architecture

Two contracts on Celo Mainnet:

- **`ChessToken.sol`** — ERC-20 CHESS token with faucet and batch-minting
- **`ChessGame.sol`** — Game engine: lifecycle, Elo rating, escrow, timeout enforcement

---

## 🚀 Protocol Status

| Layer | Component | Status |
| :--- | :--- | :--- |
| **Blockchain** | Smart Contracts (Celo) | ✅ Live Mainnet |
| **Frontend** | Landing, Lobby, Game board, History, Leaderboard, Faucet | ✅ Complete |
| **Wallet** | Reown AppKit + Web3Auth social login (email, Google, etc.) | ✅ Complete |
| **Game Flow** | Create → Approve → Spend → Join → Play → Resolve | ✅ Complete |
| **Token Checks** | Balance validation + multi-step wallet confirmation UI | ✅ Complete |
| **On-Chain Move Verification** | Hash/PGN anchoring to prevent client-side fake wins | 🔜 Planned |

---

## 🔥 Economic Model

### Gas (CELO)
Used strictly for transaction fees. All wagers use CHESS tokens only — zero financial risk.

### CHESS Token
Free-to-access in-game currency for wagers, rewards, and ranking.
- **Faucet**: 1,000 CHESS per wallet per day
- **Wagers**: Players select a CHESS amount before match creation; balance is validated before any transaction
- **Escrow**: Wagers are locked in the contract and released only on game resolution

---

## 🎮 Lifecycle Flow

1. **Connect** — User connects via Reown modal (injected wallet, WalletConnect, or social login). Auto-redirects to `/app/lobby`.
2. **Create Match** — Player A selects a wager. Balance is checked on-chain. Wallet prompts approval then game initialization (2 transactions).
3. **Join Match** — Player B joins from the lobby or by match ID. Same approve → lock flow.
4. **Gameplay** — Players alternate moves. Each move is submitted on-chain (`submitMove`). Turn order and 5-min timers enforced.
5. **Resolution** — Match ends via Checkmate (`reportWin`), Resignation, Draw, or Timeout. Contract releases the pot and updates Elo.

---

## 🗂️ Frontend Pages

| Route | Page |
| :--- | :--- |
| `/` | Landing page (Hero, Features, CTA) |
| `/app/lobby` | Game lobby — open challenges, create match, profile stats |
| `/app/game/[id]` | Live game board (react-chessboard + chess.js + on-chain moves) |
| `/app/faucet` | CHESS token faucet |
| `/app/history` | Past games for connected wallet |
| `/app/leaderboard` | On-chain Elo rankings |

---

## 🛠️ Tech Stack

- **Contracts**: Solidity 0.8.20 (Celo)
- **Frontend**: Next.js 16, TypeScript, Tailwind CSS 4.x
- **Animation**: Framer Motion
- **Wallet**: Reown AppKit, Web3Auth, Wagmi, Viem
- **Chess**: chess.js (rules), react-chessboard (UI)
- **State**: Zustand

---

## 📖 Deployed Contracts

| Contract | Address |
| :--- | :--- |
| ChessToken | `0xE370aad742dF8DC8Ae9c0F0b9f265334D39e2197` |
| ChessGame | `0xf85f00D39A84b5180390548Ea9f76B0458607E78` |

---

*"Play for the pride of the chain, stay for the thrill of the move."*
