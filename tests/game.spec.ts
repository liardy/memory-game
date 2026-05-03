import { expect, test, Page } from '@playwright/test';

type BonusId =
  | 'timer10'
  | 'sticky5'
  | 'autopair'
  | 'xray'
  | 'autoshield'
  | 'anchor'
  | 'freeze'
  | 'superpos'
  | 'microblast'
  | 'canceltrap'
  | 'trapglow'
  | 'silhouettes'
  | 'sort'
  | 'show3pairs'
  | 'pause'
  | 'doublepoints';

interface SnapshotCard {
  id: number;
  index: number;
  emoji: string;
  pairId: string;
  rotation?: number;
  isFlipped: boolean;
  isMatched: boolean;
  isHinted: boolean;
  contentHidden: boolean;
}

interface Snapshot {
  level: number;
  timeLeft: number;
  score: number;
  gameWon: boolean;
  gameOver: boolean;
  timerFrozen: boolean;
  boardFrozen: boolean;
  freezeCountdown: number | null;
  trapShiftCountdown: number | null;
  bonusesCollected: number;
  trapsTriggered: number;
  roundConditionId: string | null;
  availableBonuses: string[];
  bonusMapByPairId: Record<string, { id: BonusId; description: string }>;
  trapPairIds: string[];
  bonuses: Array<{ id: BonusId; description: string; count: number }>;
  roundModifiers: Record<string, boolean>;
  cards: SnapshotCard[];
}

const BONUS_IDS: BonusId[] = [
  'timer10',
  'sticky5',
  'autopair',
  'xray',
  'autoshield',
  'anchor',
  'freeze',
  'superpos',
  'microblast',
  'canceltrap',
  'trapglow',
  'silhouettes',
  'sort',
  'show3pairs',
  'pause',
  'doublepoints',
];

async function getState(page: Page): Promise<Snapshot> {
  return await page.evaluate(() => window.__MEMORY_GAME_TEST_API__?.getSnapshot());
}

async function setTimeLeft(page: Page, value: number): Promise<void> {
  await page.evaluate((seconds) => {
    window.__MEMORY_GAME_TEST_API__?.setTimeLeftForTest(seconds);
  }, value);
}

async function openGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect
    .poll(async () => Boolean(await page.evaluate(() => window.__MEMORY_GAME_TEST_API__)))
    .toBe(true);
}

async function startLevelWithBonus(page: Page, level: number, bonusId: BonusId): Promise<void> {
  await openGame(page);
  await page.evaluate(({ targetLevel, forcedBonusId }) => {
    window.__MEMORY_GAME_TEST_API__?.startLevelForTest(targetLevel, [forcedBonusId]);
  }, { targetLevel: level, forcedBonusId: bonusId });

  await expect.poll(async () => (await getState(page)).level).toBe(level);
  await expect
    .poll(async () => Object.values((await getState(page)).bonusMapByPairId).some((bonus) => bonus.id === bonusId))
    .toBe(true);
}

async function clickBackdoor(page: Page): Promise<void> {
  const recordButton = page.getByTestId('record-btn');
  for (let i = 0; i < 6; i += 1) {
    await recordButton.click();
    await page.waitForTimeout(60);
  }
}

function pairMap(state: Snapshot): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const card of state.cards) {
    const indices = map.get(card.pairId) ?? [];
    indices.push(card.index);
    map.set(card.pairId, indices);
  }
  return map;
}

function orderedCardIds(state: Snapshot): number[] {
  return state.cards.map((card) => card.id);
}

async function clickCard(page: Page, index: number): Promise<void> {
  await page.getByTestId(`card-${index}`).click();
}

async function clickPair(page: Page, indices: number[]): Promise<void> {
  await clickCard(page, indices[0]);
  await page.waitForTimeout(120);
  await clickCard(page, indices[1]);
  await page.waitForTimeout(1300);
}

function findBonusPairId(state: Snapshot, bonusId: BonusId): string {
  const entry = Object.entries(state.bonusMapByPairId).find(([, bonus]) => bonus.id === bonusId);
  if (!entry) throw new Error(`Bonus ${bonusId} is not present in current level`);
  return entry[0];
}

function getUnmatchedPairIds(state: Snapshot): string[] {
  return [...new Set(state.cards.filter((card) => !card.isMatched).map((card) => card.pairId))];
}

function getSafePairIds(state: Snapshot, excluded: string[] = []): string[] {
  const excludedSet = new Set(excluded);
  return getUnmatchedPairIds(state).filter(
    (pairId) => !state.trapPairIds.includes(pairId) && !excludedSet.has(pairId)
  );
}

function pickMismatchIndices(state: Snapshot): [number, number] {
  const unmatched = state.cards.filter((card) => !card.isMatched && !card.isFlipped);
  for (let i = 0; i < unmatched.length; i += 1) {
    for (let j = i + 1; j < unmatched.length; j += 1) {
      if (unmatched[i].pairId !== unmatched[j].pairId) {
        return [unmatched[i].index, unmatched[j].index];
      }
    }
  }
  throw new Error('No mismatching cards available');
}

async function useBonus(page: Page, description: string, waitMs = 150): Promise<void> {
  await page.getByText(description, { exact: true }).click();
  if (waitMs > 0) {
    await page.waitForTimeout(waitMs);
  }
}

async function collectBonus(page: Page, bonusId: BonusId): Promise<{ pairId: string; description: string }> {
  const state = await getState(page);
  const bonusPairId = findBonusPairId(state, bonusId);
  const description = state.bonusMapByPairId[bonusPairId].description;

  await clickPair(page, pairMap(state).get(bonusPairId)!);
  await expect
    .poll(async () => (await getState(page)).bonuses.find((bonus) => bonus.id === bonusId)?.count ?? 0)
    .toBe(1);

  return { pairId: bonusPairId, description };
}

async function collectSafePairs(page: Page, count: number, excluded: string[] = []): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    const state = await getState(page);
    const pairId = getSafePairIds(state, excluded)[0];
    expect(pairId, `safe pair ${i + 1}`).toBeTruthy();
    await clickPair(page, pairMap(state).get(pairId)!);
  }
}

async function collectAllRemainingPairs(page: Page): Promise<void> {
  for (;;) {
    const state = await getState(page);
    const pairId = getUnmatchedPairIds(state)[0];
    if (!pairId) return;
    await clickPair(page, pairMap(state).get(pairId)!);
    if ((await getState(page)).level !== state.level) return;
  }
}

async function prepareBonusScenario(page: Page, bonusId: BonusId): Promise<{
  description: string;
  matchedBeforeUse: number;
  timeBeforeUse: number;
  trapCountBeforeUse: number;
  remainingPairCountBeforeUse: number;
}> {
  await startLevelWithBonus(page, 2, bonusId);
  const { pairId, description } = await collectBonus(page, bonusId);
  await collectSafePairs(page, 2, [pairId]);

  const state = await getState(page);
  return {
    description,
    matchedBeforeUse: state.cards.filter((card) => card.isMatched).length,
    timeBeforeUse: state.timeLeft,
    trapCountBeforeUse: state.trapsTriggered,
    remainingPairCountBeforeUse: getUnmatchedPairIds(state).length,
  };
}

async function expectTimerFrozen(page: Page, previousTime: number): Promise<void> {
  await expect.poll(async () => (await getState(page)).timerFrozen).toBe(true);
  const frozenTime = (await getState(page)).timeLeft;
  await page.waitForTimeout(1600);
  const state = await getState(page);
  expect(state.boardFrozen).toBe(true);
  expect(state.timeLeft).toBe(frozenTime);
  expect(state.timeLeft).toBeLessThanOrEqual(previousTime);
}

test.describe('Bonus route', () => {
  test('passes level 1 via backdoor before validating the level 2 bonus route', async ({ page }) => {
    await openGame(page);
    await page.evaluate(() => {
      window.__MEMORY_GAME_TEST_API__?.startLevelForTest(1);
    });
    await clickBackdoor(page);
    await expect.poll(async () => (await getState(page)).level).toBe(2);

    const state = await getState(page);
    expect(state.bonuses.length).toBeGreaterThan(0);
    expect(state.bonusesCollected).toBeGreaterThan(0);
  });
});

test.describe('All bonus contracts', () => {
  for (const bonusId of BONUS_IDS) {
    test(`${bonusId} works according to its rule`, async ({ page }) => {
      test.setTimeout(90000);

      const setup = await prepareBonusScenario(page, bonusId);
      await useBonus(page, setup.description, bonusId === 'xray' || bonusId === 'trapglow' ? 50 : 150);

      switch (bonusId) {
        case 'timer10': {
          await expect.poll(async () => (await getState(page)).timeLeft).toBeGreaterThanOrEqual(setup.timeBeforeUse + 9);
          break;
        }
        case 'sticky5': {
          const [first, second] = pickMismatchIndices(await getState(page));
          await clickCard(page, first);
          await clickCard(page, second);
          await page.waitForTimeout(1400);

          let state = await getState(page);
          expect(state.cards.find((card) => card.index === first)?.isFlipped).toBe(true);
          expect(state.cards.find((card) => card.index === second)?.isFlipped).toBe(true);

          await page.waitForTimeout(4200);
          state = await getState(page);
          expect(state.cards.find((card) => card.index === first)?.isFlipped).toBe(false);
          expect(state.cards.find((card) => card.index === second)?.isFlipped).toBe(false);
          break;
        }
        case 'autopair': {
          await expect
            .poll(async () => {
              const state = await getState(page);
              return state.level > 2 || state.cards.filter((card) => card.isMatched).length >= setup.matchedBeforeUse + 2;
            })
            .toBe(true);
          break;
        }
        case 'xray': {
          const xrayState = await getState(page);
          expect(xrayState.cards.filter((card) => !card.isMatched).every((card) => card.isFlipped)).toBe(true);

          await page.waitForTimeout(800);
          await expect
            .poll(async () => (await getState(page)).cards.filter((card) => !card.isMatched).every((card) => !card.isFlipped))
            .toBe(true);
          break;
        }
        case 'autoshield': {
          await setTimeLeft(page, 1);
          await page.waitForTimeout(1300);

          const state = await getState(page);
          expect(state.gameOver).toBe(false);
          expect(state.timeLeft).toBeGreaterThanOrEqual(9);
          break;
        }
        case 'anchor': {
          await expect.poll(async () => Boolean((await getState(page)).roundModifiers.anchorNext)).toBe(true);

          const [first, second] = pickMismatchIndices(await getState(page));
          await clickCard(page, first);
          await clickCard(page, second);
          await page.waitForTimeout(1300);

          const state = await getState(page);
          expect(state.cards.find((card) => card.index === first)?.isFlipped).toBe(false);
          break;
        }
        case 'freeze': {
          await expectTimerFrozen(page, setup.timeBeforeUse);
          expect((await getState(page)).freezeCountdown).not.toBeNull();
          break;
        }
        case 'superpos': {
          const [first, second] = pickMismatchIndices(await getState(page));
          await clickCard(page, first);
          await clickCard(page, second);
          await page.waitForTimeout(1300);

          const state = await getState(page);
          expect(state.cards.find((card) => card.index === first)?.isFlipped).toBe(true);
          expect(state.cards.find((card) => card.index === second)?.isFlipped).toBe(false);
          break;
        }
        case 'microblast': {
          const clickTarget = (await getState(page)).cards.find((card) => !card.isMatched)?.index;
          expect(clickTarget).toBeDefined();
          await clickCard(page, clickTarget!);
          await page.waitForTimeout(120);

          const state = await getState(page);
          expect(state.cards.filter((card) => card.isFlipped || card.isMatched).length).toBeGreaterThan(
            setup.matchedBeforeUse
          );
          break;
        }
        case 'canceltrap': {
          const state = await getState(page);
          const trapPairId = state.trapPairIds[0];
          await clickPair(page, pairMap(state).get(trapPairId)!);

          const cancelledState = await getState(page);
          expect(cancelledState.trapsTriggered).toBe(setup.trapCountBeforeUse);
          expect(Boolean(cancelledState.roundModifiers.cancelTrapNext)).toBe(false);
          break;
        }
        case 'trapglow': {
          await expect
            .poll(async () => {
              const state = await getState(page);
              return state.cards.filter((card) => state.trapPairIds.includes(card.pairId) && card.isHinted).length;
            })
            .toBe(2);

          await page.waitForTimeout(800);
          await expect.poll(async () => (await getState(page)).cards.some((card) => card.isHinted)).toBe(false);
          break;
        }
        case 'silhouettes': {
          await expect
            .poll(async () => {
              const state = await getState(page);
              return state.cards.filter((card) => !card.isMatched).every((card) => card.isFlipped && card.contentHidden);
            })
            .toBe(true);

          await page.waitForTimeout(3200);
          await expect
            .poll(async () => {
              const state = await getState(page);
              return state.cards.filter((card) => !card.isMatched).every((card) => !card.isFlipped && !card.contentHidden);
            })
            .toBe(true);
          break;
        }
        case 'sort': {
          await expect
            .poll(async () => {
              const state = await getState(page);
              return state.cards.slice(0, setup.matchedBeforeUse).every((card) => card.isMatched);
            })
            .toBe(true);
          break;
        }
        case 'show3pairs': {
          const expectedHinted = Math.min(3, setup.remainingPairCountBeforeUse) * 2;
          await expect.poll(async () => (await getState(page)).cards.filter((card) => card.isHinted).length).toBe(expectedHinted);

          await page.waitForTimeout(1200);
          await expect.poll(async () => (await getState(page)).cards.some((card) => card.isHinted)).toBe(false);
          break;
        }
        case 'pause': {
          await expectTimerFrozen(page, setup.timeBeforeUse);
          expect(Boolean((await getState(page)).roundModifiers.paused)).toBe(true);
          break;
        }
        case 'doublepoints': {
          await expect.poll(async () => Boolean((await getState(page)).roundModifiers.doublePoints)).toBe(true);
          break;
        }
      }
    });
  }
});

test.describe('Bonus and special round intersections', () => {
  test('anchor blocks jumpPair movement on level 9', async ({ page }) => {
    await startLevelWithBonus(page, 9, 'anchor');
    const { description } = await collectBonus(page, 'anchor');
    await useBonus(page, description);

    const targetState = await getState(page);
    const targetPairId = getSafePairIds(targetState)[0];
    const beforeOrder = orderedCardIds(targetState);
    await clickPair(page, pairMap(targetState).get(targetPairId)!);
    await page.waitForTimeout(800);

    const afterState = await getState(page);
    expect(orderedCardIds(afterState)).toEqual(beforeOrder);
    expect(Boolean(afterState.roundModifiers.anchorNext)).toBe(false);
  });

  test('canceltrap cancels a trap while level 10 trapShift is active', async ({ page }) => {
    await startLevelWithBonus(page, 10, 'canceltrap');
    const { description } = await collectBonus(page, 'canceltrap');
    await useBonus(page, description);

    const state = await getState(page);
    const trapPairId = state.trapPairIds[0];
    await clickPair(page, pairMap(state).get(trapPairId)!);

    const afterState = await getState(page);
    expect(afterState.roundConditionId).toBe('trapShift');
    expect(afterState.trapsTriggered).toBe(0);
    expect(Boolean(afterState.roundModifiers.cancelTrapNext)).toBe(false);
  });

  test('freeze pauses the level 10 trapShift countdown', async ({ page }) => {
    await startLevelWithBonus(page, 10, 'freeze');
    const { description } = await collectBonus(page, 'freeze');
    await expect.poll(async () => (await getState(page)).trapShiftCountdown).not.toBeNull();

    await useBonus(page, description);
    const countdownAtFreeze = (await getState(page)).trapShiftCountdown;
    await page.waitForTimeout(2200);

    const afterState = await getState(page);
    expect(afterState.boardFrozen).toBe(true);
    expect(afterState.trapShiftCountdown).toBe(countdownAtFreeze);
  });

  test('pause pauses the level 10 trapShift countdown', async ({ page }) => {
    await startLevelWithBonus(page, 10, 'pause');
    const { description } = await collectBonus(page, 'pause');
    await expect.poll(async () => (await getState(page)).trapShiftCountdown).not.toBeNull();

    await useBonus(page, description);
    const countdownAtPause = (await getState(page)).trapShiftCountdown;
    await page.waitForTimeout(2200);

    const afterState = await getState(page);
    expect(afterState.boardFrozen).toBe(true);
    expect(afterState.trapShiftCountdown).toBe(countdownAtPause);
  });

  test('xray still reveals and closes cards on rotated level 13', async ({ page }) => {
    await startLevelWithBonus(page, 13, 'xray');
    const { description } = await collectBonus(page, 'xray');
    expect((await getState(page)).cards.some((card) => card.rotation !== undefined)).toBe(true);

    await useBonus(page, description, 50);
    expect((await getState(page)).cards.filter((card) => !card.isMatched).every((card) => card.isFlipped)).toBe(true);

    await page.waitForTimeout(800);
    expect((await getState(page)).cards.filter((card) => !card.isMatched).every((card) => !card.isFlipped)).toBe(true);
  });

  test('sort restores matched pairs to the top after level 14 mirror reshuffles', async ({ page }) => {
    await startLevelWithBonus(page, 14, 'sort');
    const { pairId, description } = await collectBonus(page, 'sort');
    await collectSafePairs(page, 2, [pairId]);

    const matchedBeforeUse = (await getState(page)).cards.filter((card) => card.isMatched).length;
    await useBonus(page, description);

    await expect
      .poll(async () => {
        const state = await getState(page);
        return state.roundConditionId === 'mirror' && state.cards.slice(0, matchedBeforeUse).every((card) => card.isMatched);
      })
      .toBe(true);
  });

  test('doublepoints affects the level completion score', async ({ page }) => {
    await startLevelWithBonus(page, 2, 'doublepoints');
    const { pairId, description } = await collectBonus(page, 'doublepoints');
    await collectSafePairs(page, 2, [pairId]);
    await setTimeLeft(page, 20);
    await useBonus(page, description);

    await collectAllRemainingPairs(page);
    await expect.poll(async () => (await getState(page)).score).toBeGreaterThanOrEqual(30);
  });
});
