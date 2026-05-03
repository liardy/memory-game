# Memory Game QA Rerun — Bugs Only (2026-05-03)

Scope: full-width desktop testing baseline from `TESTING_GUIDE.md`, focused on bonuses and traps.

## 1) Bonus mapping is random instead of fixed-by-card emoji

- Severity: High
- Expected (guide): each card emoji always gives its fixed bonus type.
- Actual: bonus types are sampled randomly, then assigned to random pairIds.

### Code evidence
- `src/App.tsx:392-404`
  - `bonusKeys = shuffleArray(Object.keys(EMOJI_BONUS_MAP))`
  - `selectedBonuses = bonusKeys.slice(0, config.bonusCount)`
  - then random `pairId = shuffledPairIds[i]`
  - then `bonusMap[pairId] = fixedBonus`

### Impact
- The same card emoji can produce different bonus types between runs/levels, contradicting the testing guide and design contract.

### Fix direction
- Build `bonusMap` from the matched pair’s own `pairId` (emoji) directly, then choose which pairIds are bonus-enabled without changing bonus type identity.

---

## 2) Backdoor over-grants bonuses (duplicate counting per pair)

- Severity: Critical
- Expected (guide): 6-click backdoor grants each available bonus pair once, then auto-completes non-traps.
- Actual: grant loop iterates over cards, not unique pairIds, so each bonus pair can be granted twice.

### Code evidence
- `src/App.tsx:1319-1328`
  - `bonusCards = prevCards.filter(c => availableBonuses.includes(c.pairId))`
  - loop `bonusCards.forEach(c => grantBonus(c.pairId) ... )`
  - both cards of one pair pass the filter.

### Impact
- Inflated bonus counts/inventory, invalidates bonus behavior verification, and can distort score/multipliers.

### Fix direction
- Deduplicate by `pairId` before granting (e.g., `new Set(bonusCards.map(c => c.pairId))`) and grant once per pair.

---

## 3) Death trap leads to generic timeout game-over text

- Severity: Medium
- Expected (guide): death trap (`☠️`) is instant loss with reason aligned to trap trigger.
- Actual: game-over overlay always says `Время вышло!`, even when loss came from death trap.

### Code evidence
- Death trap sets game over immediately: `src/App.tsx:292-300`
- Overlay text is static timeout reason: `src/App.tsx:1858`

### Impact
- Misleading failure reason for players and for QA validation of trap behavior.

### Fix direction
- Store game-over reason/state (`timeout | death | other`) and render context-specific message.

