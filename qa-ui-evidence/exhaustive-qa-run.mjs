import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = 'http://127.0.0.1:5173/';
const OUT_DIR = path.resolve('qa-ui-evidence', 'exhaustive-run');

const HOOK = {
  level: 0,
  cards: 1,
  flippedCards: 2,
  timeLeft: 3,
  isActive: 4,
  gameWon: 5,
  gameOver: 6,
  timerFrozen: 7,
  boardFrozen: 8,
  bonuses: 9,
  bonusMap: 10,
  bonusOrder: 11,
  availableBonuses: 12,
  trapsTriggered: 13,
  triggeredTrapIds: 14,
  bonusesCollected: 15,
  score: 16,
  showNameEntry: 17,
  playerName: 18,
  trapPairIds: 19,
  trapDefs: 20,
  markedTraps: 21,
  roundModifiers: 22,
  roundCondition: 23,
  showRoundCondition: 24,
  sectionPhase: 25,
  cardsOpenedInPhase: 26,
  failCounter: 27,
  confetti: 29,
  bonusMessage: 30,
  trapMessage: 31,
  showLevelUp: 32,
  levelCompleting: 33,
  showIntro: 34,
  showFAQ: 35,
  showRestartConfirm: 36,
  backdoorClicks: 37,
  showLevelSelect: 38,
  swappingIndices: 39,
  trapShiftCountdown: 40,
};

const LEVELS = [
  { level: 1, pairs: 4, time: 60, bonusCount: 1, trapCount: 1, condition: null },
  { level: 2, pairs: 5, time: 65, bonusCount: 1, trapCount: 1, condition: null },
  { level: 3, pairs: 6, time: 70, bonusCount: 2, trapCount: 1, condition: null },
  { level: 4, pairs: 7, time: 75, bonusCount: 2, trapCount: 1, condition: null },
  { level: 5, pairs: 8, time: 80, bonusCount: 3, trapCount: 2, condition: null },
  { level: 6, pairs: 9, time: 85, bonusCount: 3, trapCount: 2, condition: null },
  { level: 7, pairs: 10, time: 90, bonusCount: 3, trapCount: 2, condition: null },
  { level: 8, pairs: 12, time: 100, bonusCount: 0, trapCount: 0, condition: 'colorMatch' },
  { level: 9, pairs: 13, time: 105, bonusCount: 3, trapCount: 3, condition: 'jumpPair' },
  { level: 10, pairs: 14, time: 110, bonusCount: 3, trapCount: 3, condition: 'trapShift' },
  { level: 11, pairs: 15, time: 115, bonusCount: 3, trapCount: 3, condition: 'floating' },
  { level: 12, pairs: 16, time: 120, bonusCount: 3, trapCount: 3, condition: 'sections' },
  { level: 13, pairs: 17, time: 125, bonusCount: 3, trapCount: 3, condition: 'rotated' },
  { level: 14, pairs: 18, time: 130, bonusCount: 3, trapCount: 3, condition: 'mirror' },
  { level: 15, pairs: 18, time: 130, bonusCount: 3, trapCount: 3, condition: 'shiftLine' },
  { level: 16, pairs: 10, time: 120, bonusCount: 0, trapCount: 3, condition: 'fadePair' },
];

const BONUS_DESCRIPTIONS = {
  timer10: '+10 секунд к таймеру',
  sticky5: '5 сек карточки не закрываются',
  autopair: 'Открывает случайную пару',
  xray: 'На 0.5 сек показывает все карточки',
  autoshield: 'При таймере 0:00 добавит 10 сек',
  anchor: 'Следующая карта не перемещается',
  freeze: '10 сек: таймер и всё заморожено',
  superpos: 'Следующая карта остаётся открытой',
  microblast: 'Открывает карту + 4 соседних',
  canceltrap: 'Отменяет текущую/следующую ловушку',
  trapglow: 'На 0.5 сек подсвечивает ловушки',
  silhouettes: 'На 3 сек показывает силуэты всех карт',
  sort: 'Собранные пары перемещаются вверх',
  show3pairs: 'На 1 сек показывает 3 случайные пары',
  pause: 'Останавливает игру, чтобы подумать',
  doublepoints: '10 сек: удваивает очки за пары',
};

const TRAP_IDS = [
  'freeze3', 'swap2', 'hideOpen', 'slowOpen',
  'unmatch', 'freeze5', 'float', 'silhouette',
  'moveMarks', 'blur', 'speedUp', 'unmatch2',
  'death', 'shuffleAll', 'singleCard', 'ghost',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureOutDir() {
  await fs.mkdir(OUT_DIR, { recursive: true });
}

function fail(message, details = {}) {
  const err = new Error(message);
  err.details = details;
  throw err;
}

async function getSerializableState(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#root');
    const key = root ? Object.keys(root).find((k) => k.startsWith('__reactContainer')) : null;
    if (!root || !key) return null;
    const appFiber = root[key].stateNode.current.child.child;
    const hooks = [];
    let hook = appFiber.memoizedState;
    let i = 0;
    while (hook && i < 100) {
      hooks.push(hook);
      hook = hook.next;
      i += 1;
    }
    const readSet = (v) => (v instanceof Set ? Array.from(v) : []);
    return {
      level: hooks[0]?.memoizedState,
      cards: (hooks[1]?.memoizedState || []).map((c) => ({
        id: c.id,
        emoji: c.emoji,
        pairId: c.pairId,
        isFlipped: c.isFlipped,
        isMatched: c.isMatched,
        isWrong: !!c.isWrong,
        isHinted: !!c.isHinted,
        rotation: c.rotation ?? null,
        colorIndex: c.colorIndex ?? null,
        contentHidden: !!c.contentHidden,
        isBlurred: !!c.isBlurred,
      })),
      flippedCards: hooks[2]?.memoizedState || [],
      timeLeft: hooks[3]?.memoizedState,
      isActive: hooks[4]?.memoizedState,
      gameWon: hooks[5]?.memoizedState,
      gameOver: hooks[6]?.memoizedState,
      timerFrozen: hooks[7]?.memoizedState,
      boardFrozen: hooks[8]?.memoizedState,
      bonuses: hooks[9]?.memoizedState || [],
      bonusMap: hooks[10]?.memoizedState || {},
      bonusOrder: hooks[11]?.memoizedState || [],
      availableBonuses: hooks[12]?.memoizedState || [],
      trapsTriggered: hooks[13]?.memoizedState,
      triggeredTrapIds: readSet(hooks[14]?.memoizedState),
      bonusesCollected: hooks[15]?.memoizedState,
      score: hooks[16]?.memoizedState,
      trapPairIds: hooks[19]?.memoizedState || [],
      trapDefs: (hooks[20]?.memoizedState || []).map((t) => ({
        id: t.id,
        name: t.name,
        emoji: t.emoji,
        description: t.description,
      })),
      markedTraps: readSet(hooks[21]?.memoizedState),
      roundModifiers: hooks[22]?.memoizedState || {},
      roundCondition: hooks[23]?.memoizedState || null,
      sectionPhase: hooks[25]?.memoizedState,
      cardsOpenedInPhase: hooks[26]?.memoizedState,
      failCounter: hooks[27]?.memoizedState,
      bonusMessage: hooks[30]?.memoizedState,
      trapMessage: hooks[31]?.memoizedState,
      showLevelUp: hooks[32]?.memoizedState,
      levelCompleting: hooks[33]?.memoizedState,
      showIntro: hooks[34]?.memoizedState,
      showFAQ: hooks[35]?.memoizedState,
      showRestartConfirm: hooks[36]?.memoizedState,
      showLevelSelect: hooks[38]?.memoizedState,
      swappingIndices: readSet(hooks[39]?.memoizedState),
      trapShiftCountdown: hooks[40]?.memoizedState,
    };
  });
}

async function dispatchHook(page, index, value) {
  await page.evaluate(({ index, value }) => {
    const root = document.querySelector('#root');
    const key = root ? Object.keys(root).find((k) => k.startsWith('__reactContainer')) : null;
    if (!root || !key) return;
    const appFiber = root[key].stateNode.current.child.child;
    let hook = appFiber.memoizedState;
    let i = 0;
    while (hook && i < index) {
      hook = hook.next;
      i += 1;
    }
    hook?.queue?.dispatch?.(value);
  }, { index, value });
  await sleep(50);
}

async function gotoFresh(page) {
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 15000 });
  await sleep(250);
  const state = await getSerializableState(page);
  if (state?.showIntro) {
    await dispatchHook(page, HOOK.showIntro, false);
  }
  await sleep(150);
}

async function openLevelSelector(page) {
  await dispatchHook(page, HOOK.showLevelSelect, true);
  await page.waitForTimeout(100);
}

async function chooseLevel(page, level) {
  await openLevelSelector(page);
  await page.getByRole('button', { name: String(level), exact: true }).click();
  for (let i = 0; i < 40; i += 1) {
    const state = await getSerializableState(page);
    if (state && state.level === level && !state.showLevelSelect) {
      await sleep(150);
      return state;
    }
    await sleep(100);
  }
  fail(`Failed to switch to level ${level}`);
}

async function rerollLevel(page, level) {
  return chooseLevel(page, level);
}

async function clickCard(page, index, button = 'left') {
  await page.locator('.perspective-1000').nth(index).click({ button, force: true });
  await sleep(80);
}

function indicesForPair(state, pairId) {
  return state.cards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card.pairId === pairId)
    .map(({ index }) => index);
}

function unmatchedSafePairIds(state) {
  const traps = new Set(state.trapPairIds);
  const seen = new Set();
  const result = [];
  for (const card of state.cards) {
    if (!seen.has(card.pairId) && !traps.has(card.pairId)) {
      seen.add(card.pairId);
      const pair = state.cards.filter((c) => c.pairId === card.pairId);
      if (pair.some((c) => !c.isMatched)) result.push(card.pairId);
    }
  }
  return result;
}

function cardOrder(state) {
  return state.cards.map((c) => `${c.pairId}:${c.isMatched ? 'M' : c.isFlipped ? 'F' : 'C'}`);
}

async function matchPair(page, pairId) {
  let state = await getSerializableState(page);
  const pair = indicesForPair(state, pairId);
  if (pair.length !== 2) fail(`Pair not found for ${pairId}`);
  await clickCard(page, pair[0]);
  await clickCard(page, pair[1]);
  await sleep(1400);
  state = await getSerializableState(page);
  return state;
}

async function mismatchWithPairs(page, pairA, pairB) {
  let state = await getSerializableState(page);
  const a = indicesForPair(state, pairA).find((idx) => !state.cards[idx].isMatched);
  const b = indicesForPair(state, pairB).find((idx) => !state.cards[idx].isMatched);
  if (a === undefined || b === undefined) fail('Could not build mismatch');
  await clickCard(page, a);
  await clickCard(page, b);
  await sleep(1200);
  return getSerializableState(page);
}

async function ensureActive(page) {
  let state = await getSerializableState(page);
  if (state.isActive) return state;
  const first = state.cards.findIndex((c) => !c.isMatched);
  if (first >= 0) {
    await clickCard(page, first);
    state = await getSerializableState(page);
  }
  return state;
}

async function rerollUntil(page, level, predicate, maxAttempts = 30) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const state = attempt === 1 ? await chooseLevel(page, level) : await rerollLevel(page, level);
    const result = predicate(state);
    if (result) return { state, result, attempt };
  }
  fail(`Could not satisfy predicate for level ${level} after ${maxAttempts} attempts`);
}

async function useCollectedBonus(page, bonusId) {
  const description = BONUS_DESCRIPTIONS[bonusId];
  if (!description) fail(`Missing description for bonus ${bonusId}`);
  await page.getByText(description, { exact: false }).click({ force: true });
  await sleep(120);
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: true });
}

async function testLevelOverview(page) {
  const results = [];
  for (const expected of LEVELS) {
    const state = await chooseLevel(page, expected.level);
    const actual = {
      cards: state.cards.length,
      timeLeft: state.timeLeft,
      bonusCount: state.availableBonuses.length,
      trapCount: state.trapPairIds.length,
      condition: state.roundCondition?.id || null,
    };
    const pass =
      actual.cards === expected.pairs * 2 &&
      actual.timeLeft === expected.time &&
      actual.bonusCount === expected.bonusCount &&
      actual.trapCount === expected.trapCount &&
      actual.condition === expected.condition;
    results.push({
      level: expected.level,
      pass,
      expected,
      actual,
    });
  }
  return results;
}

async function testSpecialRounds(page) {
  const checks = [];

  let state = await chooseLevel(page, 8);
  checks.push({
    name: 'level8-color-mode',
    pass:
      state.cards.every((c) => c.emoji === '' && c.colorIndex !== null) &&
      state.availableBonuses.length === 0 &&
      state.trapPairIds.length === 0,
    details: {
      emojiBlank: state.cards.every((c) => c.emoji === ''),
      colorIndexes: state.cards.filter((c) => c.colorIndex !== null).length,
      bonuses: state.availableBonuses.length,
      traps: state.trapPairIds.length,
    },
  });

  state = await chooseLevel(page, 9);
  const beforeJump = cardOrder(state);
  const safeJump = unmatchedSafePairIds(state)[0];
  state = await matchPair(page, safeJump);
  const afterJump = cardOrder(state);
  checks.push({
    name: 'level9-jump-pair-reorders-board',
    pass: beforeJump.join('|') !== afterJump.join('|'),
    details: { safeJump },
  });

  state = await chooseLevel(page, 10);
  const trapId10 = state.trapPairIds[0];
  const trapIndices10 = indicesForPair(state, trapId10);
  await clickCard(page, trapIndices10[0], 'right');
  const afterMarkAttempt = await getSerializableState(page);
  const beforeShiftOrder = cardOrder(afterMarkAttempt);
  await ensureActive(page);
  await sleep(10800);
  const afterShiftState = await getSerializableState(page);
  checks.push({
    name: 'level10-no-marking-and-shift',
    pass:
      afterMarkAttempt.markedTraps.length === 0 &&
      beforeShiftOrder.join('|') !== cardOrder(afterShiftState).join('|'),
    details: {
      markedAfterRightClick: afterMarkAttempt.markedTraps,
      countdownAfterShift: afterShiftState.trapShiftCountdown,
    },
  });

  state = await chooseLevel(page, 11);
  const pos1 = await page.locator('.perspective-1000').evaluateAll((els) =>
    els.slice(0, 5).map((el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y) };
    })
  );
  await sleep(2200);
  const pos2 = await page.locator('.perspective-1000').evaluateAll((els) =>
    els.slice(0, 5).map((el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y) };
    })
  );
  checks.push({
    name: 'level11-floating-layout-moves',
    pass: JSON.stringify(pos1) !== JSON.stringify(pos2),
    details: { pos1, pos2 },
  });

  state = await chooseLevel(page, 12);
  const blockedBefore = await page.locator('.perspective-1000').evaluateAll((els) =>
    els.map((el, index) => ({ index, blocked: el.className.includes('opacity-40') })).filter((x) => x.blocked).map((x) => x.index)
  );
  const blockedTarget = blockedBefore[0];
  await clickCard(page, blockedTarget);
  const afterBlockedClick = await getSerializableState(page);
  const safePairs12 = unmatchedSafePairIds(afterBlockedClick);
  await mismatchWithPairs(page, safePairs12[0], safePairs12[1]);
  let after3 = await getSerializableState(page);
  if (after3.cardsOpenedInPhase < 2) {
    await clickCard(page, indicesForPair(after3, safePairs12[0])[0]);
    await sleep(120);
    after3 = await getSerializableState(page);
  }
  const blockedAfter = await page.locator('.perspective-1000').evaluateAll((els) =>
    els.map((el, index) => ({ index, blocked: el.className.includes('opacity-40') })).filter((x) => x.blocked).map((x) => x.index)
  );
  checks.push({
    name: 'level12-sections-block-and-switch',
    pass:
      afterBlockedClick.flippedCards.length === 0 &&
      JSON.stringify(blockedBefore) !== JSON.stringify(blockedAfter),
    details: { blockedBefore, blockedAfter, sectionPhase: after3.sectionPhase },
  });

  state = await chooseLevel(page, 13);
  checks.push({
    name: 'level13-rotations-assigned',
    pass: state.cards.every((c) => [90, 180, 270].includes(c.rotation)),
    details: { sample: state.cards.slice(0, 5).map((c) => c.rotation) },
  });

  state = await chooseLevel(page, 14);
  const beforeMirror = cardOrder(state);
  state = await matchPair(page, unmatchedSafePairIds(state)[0]);
  const afterMirror = cardOrder(state);
  checks.push({
    name: 'level14-mirror-reorders-board',
    pass: beforeMirror.join('|') !== afterMirror.join('|'),
    details: {},
  });

  state = await chooseLevel(page, 15);
  const safe15 = unmatchedSafePairIds(state).slice(0, 7);
  const beforeShiftLine = cardOrder(state);
  for (let i = 0; i < 6; i += 1) {
    await mismatchWithPairs(page, safe15[i], safe15[(i + 1) % safe15.length]);
  }
  const afterShiftLine = await getSerializableState(page);
  checks.push({
    name: 'level15-shift-line-after-6-fails',
    pass:
      afterShiftLine.failCounter === 6 &&
      beforeShiftLine.join('|') !== cardOrder(afterShiftLine).join('|'),
    details: { failCounter: afterShiftLine.failCounter },
  });

  state = await chooseLevel(page, 16);
  await dispatchHook(page, HOOK.timerFrozen, true);
  await dispatchHook(page, HOOK.isActive, false);
  const safe16 = unmatchedSafePairIds(state)[0];
  state = await matchPair(page, safe16);
  await sleep(10200);
  const fading = await getSerializableState(page);
  await sleep(5200);
  const reset = await getSerializableState(page);
  const fadePair = indicesForPair(reset, safe16);
  checks.push({
    name: 'level16-fade-pair',
    pass:
      fading.cards.filter((c) => c.pairId === safe16).every((c) => c.isHinted) &&
      reset.cards.filter((c) => c.pairId === safe16).every((c) => !c.isMatched && !c.isFlipped),
    details: { pairId: safe16, fadePair },
  });

  return checks;
}

async function prepareBonus(page, bonusId) {
  const found = await rerollUntil(
    page,
    7,
    (state) => {
      const pairId = Object.entries(state.bonusMap).find(([, bonus]) => bonus.id === bonusId)?.[0];
      return pairId ? { pairId } : null;
    },
    60
  );
  await matchPair(page, found.result.pairId);
  const state = await getSerializableState(page);
  if (!state.bonuses.find((b) => b.id === bonusId && b.count > 0)) {
    fail(`Failed to collect bonus ${bonusId}`);
  }
  return { state, pairId: found.result.pairId, attempts: found.attempt };
}

async function testBonuses(page) {
  const results = [];

  async function run(name, fn) {
    try {
      await gotoFresh(page);
      const details = await fn();
      results.push({ bonusId: name, pass: true, details });
    } catch (error) {
      results.push({
        bonusId: name,
        pass: false,
        error: error.message,
        details: error.details || null,
      });
    }
  }

  await run('timer10', async () => {
    await prepareBonus(page, 'timer10');
    const before = await getSerializableState(page);
    await useCollectedBonus(page, 'timer10');
    const after = await getSerializableState(page);
    if (after.timeLeft < before.timeLeft + 10) fail('Timer did not increase by 10');
    return { before: before.timeLeft, after: after.timeLeft };
  });

  await run('sticky5', async () => {
    const { state } = await prepareBonus(page, 'sticky5');
    const safe = unmatchedSafePairIds(state);
    await useCollectedBonus(page, 'sticky5');
    await mismatchWithPairs(page, safe[0], safe[1]);
    const mid = await getSerializableState(page);
    await sleep(5200);
    const end = await getSerializableState(page);
    if (mid.cards.filter((c) => c.isFlipped && !c.isMatched).length < 2) fail('Cards did not stay open under sticky');
    if (end.cards.some((c) => c.isFlipped && !c.isMatched)) fail('Sticky cards did not close after timeout');
    return {};
  });

  await run('autopair', async () => {
    await prepareBonus(page, 'autopair');
    const before = await getSerializableState(page);
    await useCollectedBonus(page, 'autopair');
    await sleep(150);
    const after = await getSerializableState(page);
    const matchedBefore = before.cards.filter((c) => c.isMatched).length;
    const matchedAfter = after.cards.filter((c) => c.isMatched).length;
    if (matchedAfter < matchedBefore + 2) fail('Autopair did not match a pair');
    return { matchedBefore, matchedAfter };
  });

  await run('xray', async () => {
    await prepareBonus(page, 'xray');
    await useCollectedBonus(page, 'xray');
    const during = await getSerializableState(page);
    await sleep(700);
    const after = await getSerializableState(page);
    if (!during.cards.every((c) => c.isFlipped)) fail('Xray did not open all cards');
    if (after.cards.some((c) => !c.isMatched && c.isFlipped)) fail('Xray did not close unmatched cards');
    return {};
  });

  await run('autoshield', async () => {
    await prepareBonus(page, 'autoshield');
    await useCollectedBonus(page, 'autoshield');
    await dispatchHook(page, HOOK.timeLeft, 1);
    await dispatchHook(page, HOOK.isActive, true);
    await sleep(1200);
    const after = await getSerializableState(page);
    if (after.gameOver) fail('Autoshield still allowed game over');
    if (after.timeLeft < 10) fail('Autoshield did not restore time');
    return { timeLeft: after.timeLeft };
  });

  await run('anchor', async () => {
    await chooseLevel(page, 9);
    const prep = await rerollUntil(page, 9, (state) => {
      const pairId = Object.entries(state.bonusMap).find(([, bonus]) => bonus.id === 'anchor')?.[0];
      const safe = unmatchedSafePairIds(state).find((id) => id !== pairId);
      return pairId && safe ? { pairId, safe } : null;
    }, 60);
    await matchPair(page, prep.result.pairId);
    await useCollectedBonus(page, 'anchor');
    const before = cardOrder(await getSerializableState(page));
    const after = await matchPair(page, prep.result.safe);
    const afterOrder = cardOrder(after);
    if (before.join('|') === afterOrder.join('|')) {
      return { note: 'Anchor prevented visible jump reordering' };
    }
    const msg = after.bonusMessage || '';
    if (!msg.includes('Якорь')) fail('Anchor did not surface its match message');
    return { note: 'Anchor message surfaced even though board also changed' };
  });

  await run('freeze', async () => {
    await prepareBonus(page, 'freeze');
    await useCollectedBonus(page, 'freeze');
    const after = await getSerializableState(page);
    if (!after.timerFrozen || !after.boardFrozen) fail('Freeze did not freeze timer and board');
    return {};
  });

  await run('superpos', async () => {
    const { state } = await prepareBonus(page, 'superpos');
    const safe = unmatchedSafePairIds(state);
    await useCollectedBonus(page, 'superpos');
    await mismatchWithPairs(page, safe[0], safe[1]);
    const after = await getSerializableState(page);
    if (after.cards.filter((c) => c.isFlipped && !c.isMatched).length < 1) fail('Superposition did not leave a card open');
    return {};
  });

  await run('microblast', async () => {
    const prep = await prepareBonus(page, 'microblast');
    await useCollectedBonus(page, 'microblast');
    const targetIdx = indicesForPair(prep.state, unmatchedSafePairIds(prep.state)[0])[0];
    await clickCard(page, targetIdx);
    const mid = await getSerializableState(page);
    await sleep(1200);
    const after = await getSerializableState(page);
    if (mid.cards.filter((c) => c.isFlipped).length < 2) fail('Microblast did not open neighbors');
    if (after.cards.filter((c) => c.isFlipped && !c.isMatched).length > 1) fail('Microblast cleanup left too many cards open');
    return {};
  });

  await run('canceltrap', async () => {
    const prep = await rerollUntil(page, 7, (state) => {
      const bonusPairId = Object.entries(state.bonusMap).find(([, bonus]) => bonus.id === 'canceltrap')?.[0];
      const trapPairId = state.trapPairIds[0];
      return bonusPairId && trapPairId ? { bonusPairId, trapPairId } : null;
    }, 60);
    await matchPair(page, prep.result.bonusPairId);
    await useCollectedBonus(page, 'canceltrap');
    const before = await getSerializableState(page);
    await matchPair(page, prep.result.trapPairId);
    const after = await getSerializableState(page);
    if (after.trapsTriggered !== before.trapsTriggered) fail('Cancel trap did not suppress trap count');
    if (after.roundModifiers.cancelTrapNext) fail('Cancel trap flag did not clear');
    return {};
  });

  await run('trapglow', async () => {
    await prepareBonus(page, 'trapglow');
    await useCollectedBonus(page, 'trapglow');
    const during = await getSerializableState(page);
    await sleep(650);
    const after = await getSerializableState(page);
    if (!during.cards.some((c) => c.isHinted)) fail('Trapglow did not highlight traps');
    if (after.cards.some((c) => c.isHinted)) fail('Trapglow highlights did not clear');
    return {};
  });

  await run('silhouettes', async () => {
    await prepareBonus(page, 'silhouettes');
    await useCollectedBonus(page, 'silhouettes');
    const during = await getSerializableState(page);
    await sleep(3200);
    const after = await getSerializableState(page);
    if (!during.roundModifiers.silhouetteOpen) fail('Silhouette bonus did not enable silhouette mode');
    if (!during.cards.some((c) => c.contentHidden && c.isFlipped)) fail('Silhouette bonus did not reveal hidden content state');
    if (after.roundModifiers.silhouetteOpen) fail('Silhouette bonus did not clear');
    return {};
  });

  await run('sort', async () => {
    const prep = await prepareBonus(page, 'sort');
    const safe = unmatchedSafePairIds(prep.state).slice(0, 2);
    await matchPair(page, safe[0]);
    const before = await getSerializableState(page);
    await useCollectedBonus(page, 'sort');
    const after = await getSerializableState(page);
    const firstUnmatched = after.cards.findIndex((c) => !c.isMatched);
    if (firstUnmatched < 2) fail('Sort did not move matched cards to top segment');
    return { firstUnmatched };
  });

  await run('show3pairs', async () => {
    await prepareBonus(page, 'show3pairs');
    await useCollectedBonus(page, 'show3pairs');
    const during = await getSerializableState(page);
    await sleep(1200);
    const after = await getSerializableState(page);
    if (during.cards.filter((c) => c.isHinted).length < 6) fail('Show3pairs did not hint three pairs');
    if (after.cards.some((c) => c.isHinted)) fail('Show3pairs hints did not clear');
    return {};
  });

  await run('pause', async () => {
    await prepareBonus(page, 'pause');
    await useCollectedBonus(page, 'pause');
    const paused = await getSerializableState(page);
    if (!paused.roundModifiers.paused || !paused.timerFrozen || !paused.boardFrozen) fail('Pause did not freeze game');
    const idx = paused.cards.findIndex((c) => !c.isMatched);
    await clickCard(page, idx);
    const after = await getSerializableState(page);
    if (after.roundModifiers.paused || after.timerFrozen || after.boardFrozen) fail('Pause did not clear on next click');
    return {};
  });

  await run('doublepoints', async () => {
    await prepareBonus(page, 'doublepoints');
    await useCollectedBonus(page, 'doublepoints');
    const during = await getSerializableState(page);
    if (!during.roundModifiers.doublePoints) fail('Doublepoints flag did not enable');
    return {};
  });

  return results;
}

async function prepareTrap(page, desiredTrapId, level, attempts = 60) {
  const found = await rerollUntil(page, level, (state) => {
    const index = state.trapDefs.findIndex((t) => t.id === desiredTrapId);
    return index >= 0 ? { trapIndex: index, pairId: state.trapPairIds[index] } : null;
  }, attempts);
  return found;
}

async function testTraps(page) {
  const results = [];

  async function run(trapId, fn) {
    try {
      await gotoFresh(page);
      const details = await fn();
      results.push({ trapId, pass: true, details });
    } catch (error) {
      results.push({
        trapId,
        pass: false,
        error: error.message,
        details: error.details || null,
      });
    }
  }

  await run('freeze3', async () => {
    const prep = await prepareTrap(page, 'freeze3', 4);
    await matchPair(page, prep.result.pairId);
    const during = await getSerializableState(page);
    await sleep(3200);
    const after = await getSerializableState(page);
    if (!during.boardFrozen || after.boardFrozen) fail('freeze3 timing incorrect');
    return {};
  });

  await run('swap2', async () => {
    const prep = await prepareTrap(page, 'swap2', 4);
    const before = cardOrder(prep.state);
    const after = await matchPair(page, prep.result.pairId);
    if (before.join('|') === cardOrder(after).join('|')) fail('swap2 did not change board order');
    return {};
  });

  await run('hideOpen', async () => {
    const prep = await prepareTrap(page, 'hideOpen', 4);
    let afterTrap = await matchPair(page, prep.result.pairId);
    const safe = unmatchedSafePairIds(afterTrap)[0];
    const idx = indicesForPair(afterTrap, safe)[0];
    await clickCard(page, idx);
    await sleep(1600);
    afterTrap = await getSerializableState(page);
    if (!afterTrap.cards[idx].contentHidden || !afterTrap.cards[idx].isFlipped) fail('hideOpen did not hide content on flipped card');
    return {};
  });

  await run('slowOpen', async () => {
    const prep = await prepareTrap(page, 'slowOpen', 4);
    const after = await matchPair(page, prep.result.pairId);
    if (!after.roundModifiers.slowOpen) fail('slowOpen flag not set');
    return {};
  });

  await run('unmatch', async () => {
    const prep = await prepareTrap(page, 'unmatch', 7);
    const safe = unmatchedSafePairIds(prep.state)[0];
    await matchPair(page, safe);
    const before = await getSerializableState(page);
    const after = await matchPair(page, prep.result.pairId);
    if (after.cards.filter((c) => c.isMatched).length >= before.cards.filter((c) => c.isMatched).length) fail('unmatch did not remove matched cards');
    return {};
  });

  await run('freeze5', async () => {
    const prep = await prepareTrap(page, 'freeze5', 7);
    await matchPair(page, prep.result.pairId);
    const during = await getSerializableState(page);
    if (!during.boardFrozen) fail('freeze5 did not freeze board');
    return {};
  });

  await run('float', async () => {
    const prep = await prepareTrap(page, 'float', 7);
    const after = await matchPair(page, prep.result.pairId);
    if (!after.roundModifiers.floating) fail('float flag not set');
    return {};
  });

  await run('silhouette', async () => {
    const prep = await prepareTrap(page, 'silhouette', 7);
    const after = await matchPair(page, prep.result.pairId);
    if (!after.roundModifiers.silhouetteOpen) fail('silhouette flag not set');
    return {};
  });

  await run('moveMarks', async () => {
    const prep = await prepareTrap(page, 'moveMarks', 9);
    const safeMarks = unmatchedSafePairIds(prep.state).slice(0, 2);
    await clickCard(page, indicesForPair(prep.state, safeMarks[0])[0], 'right');
    await clickCard(page, indicesForPair(prep.state, safeMarks[1])[0], 'right');
    const before = await getSerializableState(page);
    await matchPair(page, prep.result.pairId);
    const after = await getSerializableState(page);
    if (before.markedTraps.length === 0) fail('Could not create marks for moveMarks');
    if (JSON.stringify(before.markedTraps) === JSON.stringify(after.markedTraps)) fail('moveMarks did not move marks');
    return {};
  });

  await run('blur', async () => {
    const prep = await prepareTrap(page, 'blur', 9);
    let after = await matchPair(page, prep.result.pairId);
    if (after.roundModifiers.blurCount !== 6) fail('blur count not initialized to 6');
    const safe = unmatchedSafePairIds(after)[0];
    const idx = indicesForPair(after, safe)[0];
    await clickCard(page, idx);
    after = await getSerializableState(page);
    if (!after.cards[idx].isBlurred || after.roundModifiers.blurCount !== 5) fail('blur did not affect opened card');
    return {};
  });

  await run('speedUp', async () => {
    const prep = await prepareTrap(page, 'speedUp', 9);
    await matchPair(page, prep.result.pairId);
    const after = await getSerializableState(page);
    if (after.roundModifiers.timerSpeed !== 2 || !after.roundModifiers.fastOpen) fail('speedUp flags not set');
    return {};
  });

  await run('unmatch2', async () => {
    const prep = await prepareTrap(page, 'unmatch2', 9);
    const safe = unmatchedSafePairIds(prep.state).slice(0, 2);
    await matchPair(page, safe[0]);
    await matchPair(page, safe[1]);
    const before = await getSerializableState(page);
    const after = await matchPair(page, prep.result.pairId);
    if (after.cards.filter((c) => c.isMatched).length >= before.cards.filter((c) => c.isMatched).length) fail('unmatch2 did not close matched pairs');
    return {};
  });

  await run('death', async () => {
    const prep = await prepareTrap(page, 'death', 13);
    const after = await matchPair(page, prep.result.pairId);
    if (!after.gameOver) fail('death trap did not end game');
    return {};
  });

  await run('shuffleAll', async () => {
    const prep = await prepareTrap(page, 'shuffleAll', 13);
    const before = cardOrder(prep.state);
    const after = await matchPair(page, prep.result.pairId);
    if (before.join('|') === cardOrder(after).join('|')) fail('shuffleAll did not reorder board');
    return {};
  });

  await run('singleCard', async () => {
    const prep = await prepareTrap(page, 'singleCard', 13);
    let after = await matchPair(page, prep.result.pairId);
    if (!after.roundModifiers.singleCardMode) fail('singleCard flag not set');
    const safe = unmatchedSafePairIds(after).slice(0, 2);
    await clickCard(page, indicesForPair(after, safe[0])[0]);
    after = await getSerializableState(page);
    const firstOpen = after.flippedCards.length;
    await clickCard(page, indicesForPair(after, safe[1])[0]);
    const blocked = await getSerializableState(page);
    if (firstOpen !== 1 || blocked.flippedCards.length !== 1) fail('singleCard did not block second open');
    return {};
  });

  await run('ghost', async () => {
    const prep = await prepareTrap(page, 'ghost', 13);
    let after = await matchPair(page, prep.result.pairId);
    if (!after.roundModifiers.ghostMode) fail('ghost flag not set');
    const safe = unmatchedSafePairIds(after)[0];
    const idx = indicesForPair(after, safe)[0];
    await clickCard(page, idx);
    await sleep(650);
    after = await getSerializableState(page);
    if (after.cards[idx].isFlipped) fail('ghost card did not auto-hide');
    return {};
  });

  return results;
}

function summarizePasses(items, key) {
  return {
    total: items.length,
    passed: items.filter((x) => x.pass).length,
    failed: items.filter((x) => !x.pass).length,
    failedKeys: items.filter((x) => !x.pass).map((x) => x[key]),
  };
}

async function main() {
  await ensureOutDir();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    levelOverview: [],
    specialRounds: [],
    bonuses: [],
    traps: [],
    summary: {},
  };

  try {
    await gotoFresh(page);
    report.levelOverview = await testLevelOverview(page);
    await screenshot(page, 'level-overview-last.png');

    await gotoFresh(page);
    report.specialRounds = await testSpecialRounds(page);
    await screenshot(page, 'special-rounds-end.png');

    await gotoFresh(page);
    report.bonuses = await testBonuses(page);
    await screenshot(page, 'bonuses-end.png');

    await gotoFresh(page);
    report.traps = await testTraps(page);
    await screenshot(page, 'traps-end.png');
  } finally {
    await browser.close();
  }

  report.summary = {
    levelOverview: summarizePasses(report.levelOverview, 'level'),
    specialRounds: summarizePasses(report.specialRounds, 'name'),
    bonuses: summarizePasses(report.bonuses, 'bonusId'),
    traps: summarizePasses(report.traps, 'trapId'),
  };

  await fs.writeFile(
    path.join(OUT_DIR, 'report.json'),
    JSON.stringify(report, null, 2),
    'utf8'
  );

  const md = [
    '# Exhaustive QA Run',
    '',
    `Generated: ${report.generatedAt}`,
    `Base URL: ${report.baseUrl}`,
    '',
    '## Summary',
    '',
    `- Levels overview: ${report.summary.levelOverview.passed}/${report.summary.levelOverview.total} passed`,
    `- Special rounds: ${report.summary.specialRounds.passed}/${report.summary.specialRounds.total} passed`,
    `- Bonuses: ${report.summary.bonuses.passed}/${report.summary.bonuses.total} passed`,
    `- Traps: ${report.summary.traps.passed}/${report.summary.traps.total} passed`,
    '',
    '## Failed Checks',
    '',
    ...report.levelOverview.filter((x) => !x.pass).map((x) => `- Level ${x.level}: ${JSON.stringify(x.actual)}`),
    ...report.specialRounds.filter((x) => !x.pass).map((x) => `- ${x.name}: ${JSON.stringify(x.details)}`),
    ...report.bonuses.filter((x) => !x.pass).map((x) => `- Bonus ${x.bonusId}: ${x.error}`),
    ...report.traps.filter((x) => !x.pass).map((x) => `- Trap ${x.trapId}: ${x.error}`),
    '',
  ].join('\n');

  await fs.writeFile(path.join(OUT_DIR, 'report.md'), md, 'utf8');
  console.log(`Report written to ${path.join(OUT_DIR, 'report.json')}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
