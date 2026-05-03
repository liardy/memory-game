# Memory Game — Full Test Bugs (Bonuses + Traps + Round 8-16)
Date: 2026-05-03
Scope: full pass against `TESTING_GUIDE.md` (code-level verification for each bonus/trap + UI spot checks in desktop/full-width).

## Critical / High

1. **Bonus mapping contract is broken (fixed card-emoji -> fixed bonus is not preserved).**  
   Actual assignment is random bonus key -> random pairId.  
   - `src/App.tsx:392-404`

2. **Backdoor can over-grant bonuses (duplicate grant per pair).**  
   Loop iterates over bonus cards, not unique pairIds, so one pair may be granted twice.  
   - `src/App.tsx:1319-1328`

3. **Trap marks are index-based, not card-identity-based.**  
   After board reorders (`jumpPair`, `mirror`, `shiftLine`) marks stay on cells, not on original trap cards. This breaks neutralization correctness.  
   - `src/App.tsx:729`
   - `src/App.tsx:1063`
   - `src/App.tsx:1095`
   - `src/App.tsx:1248`

4. **Round 14 mirror logic is incorrect for horizontal/vertical reflection semantics.**  
   “Horizontal” branch performs full `reverse()` (effectively 180-like sequence reversal in linear array), not proper axis reflection.  
   - `src/App.tsx:1094-1098`

## Medium

5. **Autoshield has stale-closure risk in timer effect.**  
   Timer effect reads `roundModifiers.autoshieldActive` but dependency list excludes it; may miss activation edge.  
   - read: `src/App.tsx:553`
   - deps: `src/App.tsx:567`

6. **`autopair` matches by `emoji` instead of stable `pairId`.**  
   Can mark logically wrong pairs after traps that mutate displayed emoji distribution.  
   - `src/App.tsx:787`
   - `src/App.tsx:792-802`

7. **`microblast` post-check groups by `emoji` instead of `pairId`.**  
   Same logical mismatch risk as above.  
   - `src/App.tsx:940-946`

8. **`show3pairs` hint groups by `emoji` instead of `pairId`.**  
   Can highlight visually same but logically mismatched cards after reshuffle-style traps.  
   - `src/App.tsx:865`
   - `src/App.tsx:871-872`

9. **Some trap “swap/shuffle” behaviors mutate only `emoji`, not card identity/position as described.**  
   Affects expectation for “cards swapped/shuffled” semantics.  
   - `swap2`: `src/App.tsx:158-160`
   - `unmatch`: `src/App.tsx:195-198`
   - `shuffleAll`: `src/App.tsx:306-309`

10. **Trap can retrigger on same pair (guard missing despite state present).**  
   `triggeredTrapIds` is tracked but not used to block repeated activation paths.  
   - state: `src/App.tsx:454`
   - activation flow: `src/App.tsx:1131+`

11. **Death-trap loss reason is not shown distinctly in game-over UI.**  
   Overlay still shows static timeout text (`Время вышло!`).  
   - death trap sets game-over: `src/App.tsx:292-300`
   - static text: `src/App.tsx:1858`

12. **`doublepoints` behavior does not align with “10 sec doubles points for pairs” wording.**  
   Flag duration is 10s, but scoring is applied on level completion formula; effect may expire before any score impact.  
   - activation window: `src/App.tsx:897-900`
   - score application: `src/App.tsx:669-671`

