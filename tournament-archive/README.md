# Tournament archive

Snapshots of Grand Prix data pulled out of Redis before deletion, kept as a
record of what was played.

## Why S2 and S3 were voided

The season schedule used to be derived from the clock: `getTournamentAt()` took
an epoch and a week length and generated back-to-back seasons forever. That did
not match how the Grand Prix is actually run — one week on, one week off, with
each season opened deliberately.

The result was that S2 and S3 opened, scored, and (for S2) froze a winner board
entirely on their own, with no one having decided to run them. S1 is the only
season that was actually held.

Seasons are now listed explicitly in `src/config/tournaments.ts`; one exists
only because it was added there. These files are what the auto-generated
seasons had accumulated at the point they were removed.

## Files

| File | Contents |
|---|---|
| `chess_trn_S2_final.json` | S2's frozen final board — 56 players, 20 eligible, 3 winners. Never paid out. |
| `chess_trn_S2_seed.json` | S2 opening rating snapshot, 246 players (opponent-strength weighting only). |
| `chess_trn_S3_seed.json` | S3 opening rating snapshot, 247 players. S3 never reached a final board. |

S1's data is untouched and still live in Redis (`chess:trn:S1:final`,
`chess:trn:S1:seed`) — it is the season being paid out.
