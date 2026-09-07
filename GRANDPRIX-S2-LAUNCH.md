# Grand Prix S2 — Launch Kit

**Window:** Wed 9 Sep 2026, 23:59 WAT → Wed 16 Sep 2026, 23:59 WAT (7 days)
**Field:** closed — Q1 top 100 (+ ties at the line)
**Pool:** $100 USDm · 50 / 30 / 20

---

## 1. Schedule entry — SHIPPED

`src/config/tournaments.ts` now lists S2 in `EVENTS`. Nothing opens on the
clock; an event exists only because it is listed there, so this was the
blocking change.

```ts
// Grand Prix S2 — closed field, gated on Q1.
{
  seasonIndex: 2,
  kind: 'grand-prix',
  id: 'S2',
  contractSeasonId: 3,                          // 1 = S1, 2 = Q1
  name: 'Weekly Grand Prix S2',
  startsAt: Date.UTC(2026, 8, 9, 22, 59, 0),    // Sep 9 23:59 WAT
  qualifiersFrom: 'Q1',
},
```

Uses the default `seasonLengthMs` (1 week) and the default `TOURNAMENT.prizePool`
($100, 50/30/20). Override `prizePool` / `splits` on the entry if S2 differs.

---

## 2. Verified facts (source: repo, not memory)

| | |
|---|---|
| Where | celo.playchessify.xyz — Celo mainnet (42220), MiniPay-native |
| Field | **Closed.** Only Q1's top 100 (+ ties at the line) can score |
| Pool | $100 in **USDm**, split 50 / 30 / 20 — top 3 only |
| Claim | Winners pull their prize from the on-chain vault; gasless via 2771 relay; can forward to another wallet |
| Cost to play | Free. CHESS is free-to-mint (1,000/day faucet), no monetary value, gas sponsored |
| Scoring | XP, everyone starts at zero. Win 10 / Draw 4 / Loss 1, weighted by opponent strength (0.5×–2.0×) |
| Eligibility | ≥3 games **and** ≥5 distinct opponents |
| Anti-farm | Same opponent decays 1× → 0.5× → 0.1×; no opponent >25% of your XP; >10 games/day decays 0.8ⁿ; loss-farm wallets excluded |
| Settlement | Off-chain chess.js replay → on-chain oracle settle, daily cron backstop |

**The angle that sells it:** Q1 paid *wide* (10 × $10, open to everyone).
S2 pays *deep* (50/30/20, invite-only). Same engine, opposite shape.

---

## 3. Tweets

### 3.1 Announcement (main)

> Weekly Grand Prix S2 starts Wednesday, Sept 9 · 23:59 WAT ♟️
>
> Closed field. Only the top 100 from the Qualifiers are on the board.
> $100 USDm — 50 / 30 / 20. Top 3 only.
> 7 days. XP from zero. No entry fee, no wager risk, gas on us.
>
> celo.playchessify.xyz

### 3.2 Quote / reply — the anti-farm angle

> S2 scoring, plainly:
> · beat the same wallet 20× ≠ 20× the XP (1 → 0.5 → 0.1)
> · no single opponent can be >25% of your score
> · ≥5 distinct opponents or you're not prize-eligible
> · wallets that only ever lose get excluded
>
> Win real games or don't score.

### 3.3 For non-qualifiers (keeps the other 90% engaged)

> Not in the S2 field? The board is still live to watch, and the ladder is still
> live to climb.
> Qualifiers Q2 opens after S2 closes — that's the door in.
> Free to play right now: celo.playchessify.xyz

### 3.4 Day-of, one hour out (post 22:59 WAT)

> One hour. 100 players. $100.
> Grand Prix S2 opens 23:59 WAT.
> ♟️ celo.playchessify.xyz

### 3.5 Mid-week nudge (Sat 12th)

> Grand Prix S2, halfway. Four days left on the clock.
> XP is opponent-weighted — beating someone above you is worth up to 2×.
> The board moves until 23:59 WAT Wednesday.

### 3.6 Close

> Grand Prix S2 is closed. Final board frozen.
> 🥇 $50 🥈 $30 🥉 $20 — winners, your claim banner is live in the lobby.
> Qualifiers Q2 next. Everyone gets a door in.

---

## 4. Checklist before posting

- [x] **Ship the S2 config entry** above — done, `src/config/tournaments.ts`
- [ ] **Get the real qualified count** from Redis `chess:trn:Q1:final` — "top 100
      + ties" may actually be 103 / 107; the exact number is a stronger tweet
- [ ] **Confirm the pool** — S2 inherits $100 by default; if raising it, set
      `prizePool` on the entry *before* announcing (it bakes into the frozen board)
- [ ] **Fund the vault** for `contractSeasonId: 3`, or the end-of-season claim
      banner stays hidden
- [ ] **Confirm Q1 payouts are all claimed** — unclaimed prizes are bad optics on
      launch day
