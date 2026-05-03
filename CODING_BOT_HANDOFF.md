# Coding Bot Handoff

Project: `C:\Windsurf Projects\my-app`  
App: React/TypeScript memory game  
Main logic: `src/App.tsx`

## Goal

Fix the currently confirmed gameplay/UI issues found during manual QA, without changing the intended game design unless necessary.

## Verified Environment

- `npx tsc --noEmit` passes
- `npm run build` passes
- `npm run lint` fails because there is no ESLint config

## High-Value Bugs To Fix

### 1. Level 8 (`colorMatch`) has no bonuses

Expected:

- Level 8 config says `bonusCount: 5`
- The left panel should show 5 obtainable bonuses

Actual:

- Level 8 shows `No bonuses`

Repro:

1. Reach level 8
2. Check the left bonus panel

Likely cause:

- In [App.tsx](</C:/Windsurf Projects/my-app/src/App.tsx:381>), level 8 sets all pair emojis to `8️⃣`
- Bonus assignment uses `EMOJI_BONUS_MAP[emoji]`
- There is no bonus mapping for `8️⃣`, so `bonusMap` stays empty

Fix direction:

- Decouple pair identity from displayed emoji
- Add a stable pair identifier, bonus source identifier, or original bonus carrier per pair
- `colorMatch` should still display `8️⃣`, but bonus assignment must use a unique non-visual identity

### 2. Level 8 creates duplicate trap identities and breaks later UI

Expected:

- Trap list should contain only the current level's traps
- React list keys should be unique

Actual:

- React logs warnings about duplicate key `8️⃣`
- After leaving level 8, level 9 trap panel can still show an extra stale `8️⃣` trap row

Repro:

1. Reach level 8
2. Continue to level 9
3. Inspect the trap panel and console

Likely cause:

- In [App.tsx](</C:/Windsurf Projects/my-app/src/App.tsx:381>), all pairs in level 8 share the same emoji
- Trap selection uses emoji values, so `trapEmojis` can contain repeated `8️⃣`
- Trap panel renders with `key={emoji}` in [App.tsx](</C:/Windsurf Projects/my-app/src/App.tsx:1393>)

Fix direction:

- Do not use displayed emoji as the trap identity or React key
- Introduce unique trap IDs / pair IDs
- Use those IDs in trap assignment, trap matching, neutralization checks, and list keys

### 3. Narrow viewport layout is broken

Expected:

- Header controls and board should remain usable in a narrow window

Actual:

- Parts of the header, board, and side panels are clipped or pushed off-screen
- Interacting with right-side header controls can leave the visible area effectively shifted to another part of the wide layout

Repro:

1. Open the app in a narrow viewport around 400px wide
2. Start the game
3. Try using FAQ / Restart / gameplay UI

Likely cause:

- The layout assumes desktop width
- Header and three-column game area do not collapse well on narrow screens

Fix direction:

- Add a responsive layout for narrow widths
- Likely stack panels vertically or move side panels below the board
- Keep header actions visible and clickable without horizontal clipping

### 4. Trap neutralization feedback is overwritten by bonus-loss feedback

Expected:

- If a marked trap pair is opened, the player should clearly see that the trap was neutralized

Actual:

- The trap does not trigger, but the visible toast/message can be replaced immediately by the "bonus lost" message

Repro:

1. In level 1, mark both trap cards with right click
2. Open that trap pair

Likely cause:

- The neutralization path calls `showBonusMsg(...)`
- The same match flow also triggers bonus-loss messaging later in the same branch
- The second message overwrites the first

Fix direction:

- Preserve the neutralization message
- Either merge messages, queue them, or prevent bonus-loss messaging from replacing the trap-neutralized feedback immediately

### 5. `npm run lint` is dead

Expected:

- The script should work, or not exist

Actual:

- ESLint exits because no config file exists

Fix direction:

- Add ESLint config, or remove/replace the script if linting is intentionally not set up

## Confirmed Working Behavior

- App loads and starts
- Card flip/mismatch/match works in early levels
- Timer starts on first interaction
- Right-click trap marking works
- Restart confirm flow works
- FAQ modal works
- Round progression works in general
- Backdoor works: clicking `Record` 6 times clears all non-trap pairs in the current round

## Important Product/Code Notes

### Hidden backdoor

In [App.tsx](</C:/Windsurf Projects/my-app/src/App.tsx:1218>) there is a backdoor:

- 6 clicks on `Record` auto-match all non-trap cards

This is useful for QA, but should probably be gated behind a dev flag or removed for production.

### Round requirements mismatch

The provided design summary does not fully match code:

- Code has extra special rounds:
  - level 10: `changePast`
  - level 11: `floating`
  - level 14: `mirror`
  - level 16: `fadePair`

Do not remove them unless product explicitly wants that.

## Recommended Refactor Strategy

The safest fix is likely a small data-model cleanup rather than patching symptoms.

Recommended direction:

1. Add a stable pair-level identity separate from `emoji`
2. Use that identity for:
   - bonus assignment
   - trap assignment
   - trap neutralization checks
   - color-match comparisons where needed
   - React list keys
3. Keep `emoji` as display-only for special rounds like level 8

Example idea:

- Add fields like `pairId`, `displayEmoji`, `bonusSourceEmoji`, `trapId`
- Or build a pair definition array first, then generate cards from that

## Minimum Verification After Fix

1. `npx tsc --noEmit`
2. `npm run build`
3. Level 8 shows 5 obtainable bonuses
4. Level 8 trap panel has no duplicate React key warnings
5. Level 9 trap panel no longer shows stale `8️⃣`
6. Narrow viewport remains usable
7. Neutralized trap feedback is visible to the player

## Useful Files

- [App.tsx](</C:/Windsurf Projects/my-app/src/App.tsx>)
- [Card.tsx](</C:/Windsurf Projects/my-app/src/components/Card.tsx>)
- [ScorePanel.tsx](</C:/Windsurf Projects/my-app/src/components/ScorePanel.tsx>)
- [TESTING_INSTRUCTIONS.md](</C:/Windsurf Projects/my-app/TESTING_INSTRUCTIONS.md>)
- [TEST_REPORT.md](</C:/Windsurf Projects/my-app/TEST_REPORT.md>)
