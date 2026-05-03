# Bonus E2E Handoff for Developer Bot

Date: 2026-05-03

## Scope

Added a deterministic Playwright headed e2e suite for bonus mechanics in `tests/game.spec.ts`.

Coverage now includes:

- Backdoor route: level 1 is passed through the record-button backdoor before validating level 2 entry.
- Base contract for all 16 bonuses: `timer10`, `sticky5`, `autopair`, `xray`, `autoshield`, `anchor`, `freeze`, `superpos`, `microblast`, `canceltrap`, `trapglow`, `silhouettes`, `sort`, `show3pairs`, `pause`, `doublepoints`.
- Special round intersections:
  - `anchor` with level 9 `jumpPair`.
  - `canceltrap` with level 10 `trapShift`.
  - `freeze` with level 10 `trapShift`.
  - `pause` with level 10 `trapShift`.
  - `xray` with level 13 `rotated`.
  - `sort` with level 14 `mirror`.
  - `doublepoints` against real level completion score.

To keep the tests reproducible, `src/App.tsx` now exposes a test-only state API on `window.__MEMORY_GAME_TEST_API__`. The tests still click real cards and real bonus controls, but they can start a chosen level with a chosen forced bonus instead of waiting for random selection.

## Run Commands

Build:

```powershell
npm run build
```

Result: passed.

Lint:

```powershell
npm run lint
```

Result: passed with 6 existing `react-hooks/exhaustive-deps` warnings in `src/App.tsx` and 0 errors.

Headed e2e:

```powershell
npx playwright test --headed
```

Result: 24 tests run, 22 passed, 2 failed.

## Confirmed Passing Areas

The base behavior for every bonus passed on a normal level 2 board:

- `timer10`: adds time.
- `sticky5`: mismatched cards stay open during the sticky window, then close.
- `autopair`: opens/matches an additional pair or advances if it completes the board.
- `xray`: reveals all unmatched cards briefly, then closes them.
- `autoshield`: prevents game over at 0:00 and adds time.
- `anchor`: activates its next-card modifier.
- `freeze`: freezes board and timer on a normal round.
- `superpos`: keeps the first mismatched card open.
- `microblast`: opens the clicked card and neighbors.
- `canceltrap`: cancels the next trap.
- `trapglow`: highlights trap cards briefly.
- `silhouettes`: shows hidden silhouettes, then closes them.
- `sort`: moves matched pairs to the top.
- `show3pairs`: hints up to 3 remaining pairs, then clears hints.
- `pause`: freezes board and timer on a normal round.
- `doublepoints`: activates the double-points modifier and increases completion score.

Special intersections that passed:

- `anchor` prevents level 9 `jumpPair` movement for the next matched pair.
- `canceltrap` cancels a trap while level 10 `trapShift` is active.
- `xray` works on level 13 rotated cards.
- `sort` restores matched pairs to the top after level 14 mirror movement.

## Failing Tests / Bugs

### BUG-1: `freeze` does not pause level 10 `trapShift` countdown

Test:

```text
tests/game.spec.ts:448
Bonus and special round intersections > freeze pauses the level 10 trapShift countdown
```

Observed:

```text
Expected trapShiftCountdown: 9
Received trapShiftCountdown: 7
boardFrozen: true
```

Repro:

1. Start level 10 with forced `freeze` bonus.
2. Collect the `freeze` bonus.
3. Wait for `trapShiftCountdown` to be active.
4. Use `freeze`.
5. Wait about 2.2 seconds.

Expected:

`freeze` says "timer and everything frozen", so the level 10 trap-shift countdown and swap scheduler should pause while the board is frozen.

Actual:

`boardFrozen` is true, but `trapShiftCountdown` keeps ticking down from 9 to 7.

Likely source:

- `src/App.tsx:745` starts the level 10 trapShift effect when `roundCondition?.id === 'trapShift' && isActive && !gameWon && !gameOver`.
- The effect does not check `boardFrozen`, `timerFrozen`, or `roundModifiers.paused`.
- The countdown interval at `src/App.tsx:750` keeps running while the freeze bonus is active.

Evidence:

- `test-results/game-Bonus-and-special-rou-e7706-evel-10-trapShift-countdown-chromium/error-context.md`
- `test-results/game-Bonus-and-special-rou-e7706-evel-10-trapShift-countdown-chromium/test-failed-1.png`

### BUG-2: `pause` does not pause level 10 `trapShift` countdown

Test:

```text
tests/game.spec.ts:462
Bonus and special round intersections > pause pauses the level 10 trapShift countdown
```

Observed:

```text
Expected trapShiftCountdown: 9
Received trapShiftCountdown: 7
boardFrozen: true
```

Repro:

1. Start level 10 with forced `pause` bonus.
2. Collect the `pause` bonus.
3. Wait for `trapShiftCountdown` to be active.
4. Use `pause`.
5. Wait about 2.2 seconds.

Expected:

`pause` stops the game for 10 seconds, so the level 10 trap-shift countdown and swap scheduler should pause while the game is paused.

Actual:

`boardFrozen` is true, but `trapShiftCountdown` keeps ticking down from 9 to 7.

Likely source:

- Same trapShift effect as BUG-1.
- The effect is independent from `roundModifiers.paused`.

Evidence:

- `test-results/game-Bonus-and-special-rou-c92fa-evel-10-trapShift-countdown-chromium/error-context.md`
- `test-results/game-Bonus-and-special-rou-c92fa-evel-10-trapShift-countdown-chromium/test-failed-1.png`

## Suggested Fix Direction

Update the level 10 trapShift effect so its countdown and swap interval respect frozen/paused state.

Candidate behavior:

- If `boardFrozen` or `timerFrozen` or `roundModifiers.paused` is true, do not decrement `trapShiftCountdown`.
- Do not execute trap/non-trap swaps while frozen or paused.
- Keep the current countdown value during the frozen window, then resume from that value after unfreeze/unpause.

After fixing, rerun:

```powershell
npm run build
npx playwright test --headed
```

Expected target: 24 passed, 0 failed.
