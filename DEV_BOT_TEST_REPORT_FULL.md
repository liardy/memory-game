# Full Retest Report (Against TESTING_GUIDE.md)

Project: `C:\Windsurf Projects\my-app`  
Date: 2026-05-03  
Source of expected behavior: `TESTING_GUIDE.md`  
Scope: desktop-width gameplay retest (narrow/mobile ignored by request)

## Test approach

- Re-ran gameplay with updated mechanics.
- Used in-game backdoor (`6` clicks on `Record`) for accelerated progression.
- Reached and inspected special rounds (including rounds `8`, `10`, `16`) and trap/bonus behavior.
- Cross-checked key mechanics against current code in [App.tsx](</C:/Windsurf Projects/my-app/src/App.tsx>) and runtime behavior.

## Confirmed mismatches / bugs

## BUG-01. Backdoor grants duplicate bonus counts (per card, not per pair)

Severity: High  
Area: Backdoor + bonus integrity  
Guide expectation:

- Backdoor should grant level bonuses and complete non-trap cards.
- Bonus accounting should still remain logically correct (one bonus source per pair).

Observed:

- After backdoor, collected bonuses frequently jump by `x2` increments for the same bonus type in early rounds.
- Example seen in runtime: same collected bonus type displayed as `x2` after a single backdoor level pass where only one bonus pair was expected.

Technical cause:

- In [App.tsx](</C:/Windsurf Projects/my-app/src/App.tsx:1320>), backdoor iterates `bonusCards` created from physical cards, not unique pair IDs.
- Both cards of a pair call `grantBonus(...)`, so the same bonus is added twice.

## BUG-02. Card emoji -> bonus mapping is not fixed as required by guide

Severity: High  
Area: Core bonus design rule  
Guide expectation:

- Each card emoji must always map to one fixed bonus type.

Observed:

- Runtime shows mismatched pairings (card visual and bonus text/effect do not follow fixed mapping table from guide).
- Example pattern observed in collected list: card emoji associated with a bonus description that belongs to a different emoji in the guide mapping.

Technical cause:

- Current setup assigns random bonus keys to random pair IDs in [App.tsx](</C:/Windsurf Projects/my-app/src/App.tsx:392>)–[App.tsx](</C:/Windsurf Projects/my-app/src/App.tsx:404>) instead of deriving bonus directly from the card emoji/pair identity.

## BUG-03. Death-trap loss reason is not distinguished on Game Over screen

Severity: Medium  
Area: Trap feedback / loss UX  
Guide expectation:

- Trap `death` is a distinct instant-loss cause.

Observed:

- Game-over overlay text is hardcoded to `Время вышло!`, regardless of death-trap cause.

Technical evidence:

- Death trap sets `gameOver` in [App.tsx](</C:/Windsurf Projects/my-app/src/App.tsx:291>)–[App.tsx](</C:/Windsurf Projects/my-app/src/App.tsx:297>).
- Game-over overlay reason text is static in [App.tsx](</C:/Windsurf Projects/my-app/src/App.tsx:1613>).

## Additional validated behavior (passes)

- Round 8 configured as color-only mode with no new bonuses/traps (`LEVELS` and runtime align with guide).
- Round 10 trap-shift behavior present:
  - right-click marking disabled (`Пометка недоступна`);
  - countdown appears after round starts;
  - trap position updates over time.
- Round 10 pair count/time/bonus/trap counts align with guide table.
- Round 16 starts with no new bonuses (guide-aligned).
- Trap and bonus identities are separated via `pairId`, preventing direct bonus/trap overlap in setup logic.

## Coverage notes

- Desktop-width retest completed; narrow/mobile intentionally excluded.
- Some late-round visuals (`fadePair` full timed lifecycle) were partially spot-checked during accelerated runs but not exhaustively frame-by-frame validated in this pass.

## Recommended fix order

1. Fix backdoor bonus duplication (unique pair-based grant only).
2. Restore strict fixed emoji->bonus mapping per guide.
3. Add explicit game-over reason state (timeout vs death trap) and show correct text.
