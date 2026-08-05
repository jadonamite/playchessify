# GoodAgent integration (PlayChessify)

Embeds the [@goodagent/widget](https://www.npmjs.com/package/@goodagent/widget) on `/app/agents` so players can deploy, verify, and run **PlayChessify 1v1** agents (`gaming/wagering/playchessify_1v1`).

## What was added

| Piece | Path |
|-------|------|
| Deploy & verify | `/app/agents` — widget `mode="onboard"` only |
| Command deck | `/app/agents/deck` — settings, autopilot, match history |
| Host proxy | `src/app/api/goodagent/[...path]/route.ts` |
| Widget config | `src/lib/goodagent-config.ts` |
| Mainnet handover defaults | `src/config/contracts.ts` |
| v1 `getGame` ABI for relay | `src/config/abis.ts`, `src/lib/celo-server.ts` |

## Local preview

```bash
npm install
npm run dev
# open http://localhost:3000/app/agents
```

Copy `.env.example` to `.env.local` and fill in values:

```env
# Privy (required for /app/agents wallet + GoodAgent widget)
NEXT_PUBLIC_PRIVY_APP_ID=

# Proxy target (defaults to production host)
GOODAGENT_HOST_URL=https://goodagentids.xyz/host

# Optional partner key if host requires it
GOODAGENT_PARTNER_API_KEY=

# Align UI + move relay with handover mainnet (recommended for production)
NEXT_PUBLIC_CELO_TOKEN=0x3f7efdfc8a76f76f22512fcd2bddc5fca36e55a3
NEXT_PUBLIC_CELO_GAME=0xb37877a9ebd6c3169b2eaaa3e16852839785ae85
```

## Contract alignment

Production README targets the **handover** game contract (`0xb37877…`). Code defaults now match that stack on mainnet. The move relay uses a **v1-shaped** `getGame` read when the configured game address is the handover contract (7 fields, block-based `createdAt`).

Set the same `NEXT_PUBLIC_CELO_*` values on Vercel so the UI, relay, and agents skill all read the same chain state.

## Wallet

PlayChessify already uses Privy. The agents page uses `usePrivyWalletAdapter({ preferExternal: true })` so MiniPay / external wallets sign deploy and vouch flows reliably.
