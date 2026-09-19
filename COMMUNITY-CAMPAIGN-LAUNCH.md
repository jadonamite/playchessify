# Community chess campaign launch kit

Window: Saturday 19 September 2026, 18:00 GMT to Saturday 26 September 2026, 18:00 GMT (7 days).  
Daily schedule: 24/7 GMT.  
Field: Open to all players.  
Prize pool: 100 USDm distributed equally across the top 10 players (10 USDm each).  
Theme: More games, more players, bigger community.  

## 1. Schedule entry

src/config/tournaments.ts lists the community campaign in EVENTS. Events are opened manually. Adding it to the registry activates the campaign for the window.

```ts
// Community Chess Campaign — Sep 19–25 2026 GMT.
// Open field: "More Games / More Players / Bigger Community".
// 24/7 games starting at 18:00 GMT throughout the 7-day window.
// $100 total prize pool distributed equally across the top 10 ($10 USDm each).
{
  seasonIndex: 1,
  kind: 'community',
  id: 'C1',
  contractSeasonId: 4,
  name: 'Community Chess Campaign',
  startsAt: Date.UTC(2026, 8, 19, 18, 0, 0), // Sep 19 18:00 GMT
  lengthMs: 7 * 24 * 60 * 60 * 1000,
  prizePool: 100,
  splits: COMMUNITY_SPLITS,
},
```

## 2. Verified facts

| Property | Value |
|---|---|
| Where | celo.playchessify.xyz on Celo mainnet (chain ID 42220) |
| Field | Open. Any address can play and climb from zero XP |
| Schedule | Starts 19 September at 18:00 GMT, runs 24/7 for 7 days |
| Pool | 100 USDm split equally across the top 10 players (10 USDm each) |
| Claim | Winners withdraw from the TournamentRewards contract via gasless relay |
| Cost | Free. CHESS mints daily from the faucet, and Celo gas is sponsored |
| Scoring | Win is 10 XP, draw is 4 XP, loss is 1 XP, weighted by opponent rating |
| Eligibility | At least 3 games and at least 5 different opponents |
| Anti-farm | Repeat opponents decay (1x, 0.5x, 0.1x), 25% single-opponent cap, feeder accounts excluded |
| Settlement | Independent chess.js move verification on server, on-chain oracle settlement |

The differentiator: Q1 paid 10 players 10 dollars each, and S2 paid top 3 only. This campaign runs open field 24/7 for a week, and every player in the top 10 takes 10 dollars.

## 3. Social copy

### 3.1 Launch announcement (18:00 GMT)

Community Chess Campaign opens today at 18:00 GMT on Celo.

Seven days. 24/7 games. Open board.

We put 100 USDm in the prize vault. At the end of the week, the top ten players on the board split it equally: 10 dollars each, straight from the contract.

No entry fee. No wager required. CHESS is free from the faucet, and gas is covered on Celo.

celo.playchessify.xyz/app/tournaments

### 3.2 Anti-farm and rules reply

Scoring is XP based:

- Win: 10 XP. Draw: 4 XP. Loss: 1 XP.
- Beat a player rated higher than you and you earn up to 2x.
- Beat the same address repeatedly and the score decays: 1x on game one, 0.5x on game two, 0.1x after that.
- You need at least 3 games and at least 5 different opponents to qualify for a payout.

Accounts that only lose to feed points to a partner are dropped from the board.

### 3.3 Mid-week post (Tuesday 22 September)

Three days into the Community Chess Campaign.

The top ten positions all pay the same 10 USDm prize. Because XP is weighted against opponent rating, beating an opponent above you can shift your standing in a single match.

The board updates live around the clock: celo.playchessify.xyz/app/tournaments

### 3.4 Final day post (Friday 25 September)

Final 24 hours of the Community Chess Campaign.

The board locks Saturday at 18:00 GMT. Ten players split the 100 USDm prize vault.

Queue matches now: celo.playchessify.xyz/app/lobby

### 3.5 Conclusion post

The Community Chess Campaign board is frozen.

Top 10 players have prize claims available directly in the lobby at celo.playchessify.xyz/app/lobby. Claims route through the gasless forwarder.

## 4. Operational checklist

- [x] Schedule entry shipped in src/config/tournaments.ts (startsAt: 18:00 GMT, contractSeasonId: 4).
- [x] Poster asset saved to public/campaigns/community-campaign.png.
- [x] Lobby banner displays countdown before 18:00 GMT and live status once open.
- [x] Leaderboard ribbon displays Community Chess Campaign with active timing.
- [x] Tournament page configured with flat wide split display and prize labels.
- [x] Campaign link added to navigation bar and side rail.
- [ ] Seed winners into TournamentRewards using celo-contracts/open-season.sh once concluded on 26 September.
