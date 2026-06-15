# GamePlay Refactor Plan

> **Status (2026-06-15): largely done.** `src/components/game/GameClient.tsx` went from a
> single ~1,060-line component to a ~550-line orchestrator. The view layer and on-chain data
> sync are now extracted into focused files. Remaining items are the deeper logic-hook
> extractions (engine/bot/board-interaction), deferred as lower-value / higher-risk on a live
> component.

## Done (2026-06-15)

- [x] **Extract Game Data Synchronization** → `src/hooks/useGameData.ts` (getGame poll + gameData
  state + derived identity/status/draw flags + profile map).
- [x] **Isolate Move History Component** → `src/components/game/MoveLog.tsx`.
- [x] **Isolate Player Stats / header** → `src/components/game/GameHeader.tsx`.
- [x] **Isolate Game Operations** → `src/components/game/GameSidebar.tsx` (join / waiting / bot /
  turn-state / hint / draw / resign cards + connect nudge).
- [x] **Isolate board view** → `src/components/game/BoardPanel.tsx` (board + captured trays +
  turn bar + sound toggle).
- [x] **Isolate result + ambient/layout UI** → `GameResultOverlay.tsx`, `AmbientBackground.tsx`,
  `CapturedTray.tsx`; shared `types.ts`.

## Remaining (optional follow-ups)

- [ ] Extract Chess Engine Logic Hook (`game`/`moveHistory`/`executeMove`).
- [ ] Isolate AI/Bot Move Logic (`getBestMove` reply timer, bot persistence).
- [ ] Extract Board Interaction Handlers (drag/click/promotion) — currently still in GameClient
  because they close tightly over `executeMove` + relay + bot state.

These three stay in the GameClient orchestrator for now; extracting them is a behavior-sensitive
change best done with the move/relay/bot flow under test first.
