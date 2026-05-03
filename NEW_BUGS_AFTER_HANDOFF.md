# New Bugs After Handoff

This file contains only bugs found after `CODING_BOT_HANDOFF.md` was created.

## BUG-07. New backdoor grants duplicate bonuses

Severity: High  
Area: Backdoor / bonus granting  
Files: [App.tsx](</C:/Windsurf Projects/my-app/src/App.tsx:1223>)

Expected:

- Backdoor should grant each obtainable level bonus once per bonus pair
- On level 1, where `bonusCount` is `2`, the player should receive `2` bonuses total

Actual:

- After using the new backdoor on level 1, the compact UI showed `🎁 4 бонусов`
- This is double the expected amount

Repro:

1. Start a fresh game on level 1
2. Click `Record` 6 times
3. Wait for the backdoor to complete
4. Observe the bonus counter

Why this likely happens:

- The backdoor filters `bonusCards` from `prevCards`
- That list contains both physical cards of each bonus pair
- `grantBonus(c.pairId)` is called for each card, not once per pair

Relevant code:

```ts
const bonusCards = prevCards.filter(c => availableBonuses.includes(c.pairId));
bonusCards.forEach(c => {
  if (availableBonuses.includes(c.pairId)) {
    grantBonus(c.pairId);
    setAvailableBonuses(prev => prev.filter(e => e !== c.pairId));
    setBonusesCollected(prev => prev + 1);
  }
});
```

Impact:

- Backdoor-based QA of bonuses becomes inaccurate
- Bonus counts and round score inputs are inflated

## BUG-06. Level 10 special mechanic `changePast` does not work in normal gameplay

Severity: High  
Area: Round 10 special rule  
Files: [App.tsx](</C:/Windsurf Projects/my-app/src/App.tsx:350>), [App.tsx](</C:/Windsurf Projects/my-app/src/App.tsx:924>)

Expected:

- Round 10 is described as `changePast`
- When opening cards during round 10, previously opened unmatched cards should change to random images

Actual:

- In live testing on level 10, opening cards does not cause previously opened unmatched cards to change
- The visible card sequence stays unchanged during normal play

Repro:

1. Reach level 10
2. Close the round intro overlay
3. Open one card
4. Open a second different card
5. Observe that the previously opened card does not change into a random image

Why this likely happens:

- The runtime branch is:
  - `roundCondition?.id === 'changePast'`
  - `newFlipped.length === 1`
- At that moment, the code looks for `otherFlipped` cards excluding the currently opened one
- In normal gameplay, there are no other flipped unmatched cards on the first open, so the branch returns without changing anything

Relevant code:

```ts
// Level 10: change past — when opening a card, previously flipped unmatched cards get random images
if (roundCondition?.id === 'changePast' && newFlipped.length === 1) {
  setCards(prev => {
    const otherFlipped = prev.map((c, i) => ({ c, i }))
      .filter(x => x.i !== index && x.c.isFlipped && !x.c.isMatched);
    if (otherFlipped.length === 0) return prev;
```

Impact:

- Round 10's signature mechanic is effectively missing for ordinary players
- The round behaves like a mostly normal round instead of its intended variant

## Additional checks completed with no new confirmed bug

- Reached levels 12, 13, 16 and the final win screen
- Win screen opened correctly
- Saving a name on the win screen completed without visible UI failure
- Level 12 `sections` appeared to switch active areas during spot checks

## Still not fully covered in this pass

- Explicit runtime verification of level 11, 14, 15, 16 special mechanics in detail
- Game-over flow caused specifically by `Death` trap
- LocalStorage contents validated directly after saving
