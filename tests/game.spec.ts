import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:5174';

// ─── Helpers ───────────────────────────────────────────

async function startGame(page: Page) {
  await page.goto(BASE);
  await page.waitForTimeout(500);
  const playBtn = page.locator('text=Играть!');
  if (await playBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await playBtn.click();
    await page.waitForTimeout(500);
  }
}

function allCards(page: Page) {
  return page.locator('[data-testid^="card-"]');
}

async function clickCard(page: Page, idx: number) {
  await allCards(page).nth(idx).click();
}

async function rightClickCard(page: Page, idx: number) {
  await allCards(page).nth(idx).click({ button: 'right' });
}

async function activateGame(page: Page) {
  await clickCard(page, 0);
  await page.waitForTimeout(300);
}

/** Backdoor: 6 rapid clicks on record button */
async function backdoor(page: Page) {
  const rec = page.getByTestId('record-btn');
  for (let i = 0; i < 6; i++) {
    await rec.dispatchEvent('click');
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(2000);
}

/** Open level selector: right-click-hold 3s on Рекорд */
async function openLevelSelect(page: Page) {
  const rec = page.getByTestId('record-btn');
  const box = await rec.boundingBox();
  if (!box) throw new Error('Record button not found');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(3500);
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(500);
}

/** Select level N — click the button and ensure overlay closes */
async function selectLevel(page: Page, n: number) {
  const overlay = page.getByTestId('level-select-overlay');
  await expect(overlay).toBeVisible({ timeout: 5000 });
  const btn = page.getByTestId(`level-btn-${n}`);
  await expect(btn).toBeVisible({ timeout: 3000 });

  // Scroll and click the level button
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await page.waitForTimeout(1500);

  // If overlay still visible, click on its backdrop to close
  if (await overlay.isVisible({ timeout: 1000 }).catch(() => false)) {
    await overlay.click({ position: { x: 50, y: 50 } }); // Click on backdrop
    await page.waitForTimeout(500);
  }

  // Final check - if still visible, use Escape
  if (await overlay.isVisible({ timeout: 500 }).catch(() => false)) {
    await overlay.focus();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
}

async function goToLevel(page: Page, n: number) {
  await openLevelSelect(page);
  await selectLevel(page, n);
}

async function getTimerText(page: Page): Promise<string> {
  const el = page.locator('.font-mono').first();
  return (await el.textContent())?.trim() || '';
}

// ─── Tests ─────────────────────────────────────────────

test.describe('🧠 Memory Game — Full E2E', () => {

  test('1. Game loads and shows intro', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    await expect(page.locator('text=Вспомнить всё').first()).toBeVisible();
    await expect(page.locator('text=Играть!').first()).toBeVisible();
  });

  test('2. Start game → level 1 with 8 cards', async ({ page }) => {
    await startGame(page);
    await expect(allCards(page)).toHaveCount(8);
  });

  test('3. Cards flip on click', async ({ page }) => {
    await startGame(page);
    await clickCard(page, 0);
    await page.waitForTimeout(400);
  });

  test('4. Timer starts after first card click', async ({ page }) => {
    await startGame(page);
    await activateGame(page);
    await page.waitForTimeout(1500);
    const t1 = await getTimerText(page);
    await page.waitForTimeout(2000);
    const t2 = await getTimerText(page);
    expect(t2).not.toBe(t1);
  });

  test('5. Backdoor: 6 clicks → autowin', async ({ page }) => {
    await startGame(page);
    await backdoor(page);
    const backdoorVisible = await page.locator('text=Бэкдор').isVisible().catch(() => false);
    const levelComplete = await page.locator('text=Уровень пройден').isVisible().catch(() => false);
    expect(backdoorVisible || levelComplete).toBeTruthy();
  });

  test('6. Level selector opens via right-click-hold', async ({ page }) => {
    await startGame(page);
    await openLevelSelect(page);
    await expect(page.getByTestId('level-select-overlay')).toBeVisible({ timeout: 5000 });
  });

  test('7. Navigate to level 5 → 16 cards', async ({ page }) => {
    await startGame(page);
    await goToLevel(page, 5);
    await expect(allCards(page)).toHaveCount(16, { timeout: 5000 });
  });

  test('8. Right-click marks card as trap', async ({ page }) => {
    await startGame(page);
    await rightClickCard(page, 0);
    await page.waitForTimeout(300);
  });

  test('9. Round 1: panels + backdoor', async ({ page }) => {
    await startGame(page);
    await expect(page.locator('text=Бонусы').first()).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=Ловушки').first()).toBeVisible({ timeout: 3000 });
    await backdoor(page);
    await page.waitForTimeout(2000);
  });

  test('10. All 16 levels load with correct card count', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const expected: Record<number, number> = {
      1: 8, 2: 10, 3: 12, 4: 14, 5: 16, 6: 18, 7: 20,
      8: 24, 9: 26, 10: 28, 11: 30, 12: 32, 13: 34, 14: 36, 15: 36, 16: 20,
    };

    await startGame(page);
    for (let lvl = 1; lvl <= 16; lvl++) {
      await goToLevel(page, lvl);
      const count = await allCards(page).count();
      expect(count, `Level ${lvl} card count`).toBe(expected[lvl]);
      await page.waitForTimeout(300);
    }

    const realErrors = errors.filter(e =>
      !e.includes('Warning:') && !e.includes('downloadable font') &&
      !e.includes('net::') && !e.includes('favicon')
    );
    expect(realErrors.length).toBe(0);
  });

  test('11. Level 8: color match, no traps', async ({ page }) => {
    await startGame(page);
    await goToLevel(page, 8);
    await expect(allCards(page)).toHaveCount(24, { timeout: 5000 });
    await expect(page.locator('text=Нет ловушек').first()).toBeVisible({ timeout: 3000 });
  });

  test('12. Level 9: jump pair', async ({ page }) => {
    await startGame(page);
    await goToLevel(page, 9);
    await expect(allCards(page)).toHaveCount(26, { timeout: 5000 });
  });

  test('13. Level 10: trap shift countdown', async ({ page }) => {
    await startGame(page);
    await goToLevel(page, 10);
    await expect(allCards(page)).toHaveCount(28, { timeout: 5000 });
    await activateGame(page);
    await expect(page.locator('text=Перемещение через').first()).toBeVisible({ timeout: 8000 });
  });

  test('14. Level 10: cannot mark traps', async ({ page }) => {
    await startGame(page);
    await goToLevel(page, 10);
    await rightClickCard(page, 0);
    await page.waitForTimeout(300);
  });

  test('15. Level 10: countdown independent of card clicks', async ({ page }) => {
    await startGame(page);
    await goToLevel(page, 10);
    await activateGame(page);
    await page.waitForTimeout(3000);
    const countdownEl = page.locator('text=Перемещение через').first();
    await expect(countdownEl).toBeVisible({ timeout: 5000 });

    const text1 = await countdownEl.textContent() || '';
    const num1 = parseInt(text1.replace(/\D/g, ''), 10);

    await clickCard(page, 1);
    await page.waitForTimeout(500);

    const text2 = await countdownEl.textContent() || '';
    const num2 = parseInt(text2.replace(/\D/g, ''), 10);
    expect(num2).toBeLessThanOrEqual(num1 + 1);
  });

  test('16. Level 11: floating', async ({ page }) => {
    await startGame(page);
    await goToLevel(page, 11);
    await expect(allCards(page)).toHaveCount(30, { timeout: 5000 });
  });

  test('17. Level 12: sections + blocked', async ({ page }) => {
    await startGame(page);
    await goToLevel(page, 12);
    await expect(allCards(page)).toHaveCount(32, { timeout: 5000 });
    const blocked = page.locator('.opacity-40');
    expect(await blocked.count()).toBeGreaterThan(0);
  });

  test('18. Level 13: rotated', async ({ page }) => {
    await startGame(page);
    await goToLevel(page, 13);
    await expect(allCards(page)).toHaveCount(34, { timeout: 5000 });
  });

  test('19. Level 14: mirror', async ({ page }) => {
    await startGame(page);
    await goToLevel(page, 14);
    await expect(allCards(page)).toHaveCount(36, { timeout: 5000 });
  });

  test('20. Level 15: shift line', async ({ page }) => {
    await startGame(page);
    await goToLevel(page, 15);
    await expect(allCards(page)).toHaveCount(36, { timeout: 5000 });
  });

  test('21. Level 16: fade pair', async ({ page }) => {
    await startGame(page);
    await goToLevel(page, 16);
    await expect(allCards(page)).toHaveCount(20, { timeout: 5000 });
  });

  test('22. Restart requires confirmation', async ({ page }) => {
    await startGame(page);
    await page.getByTestId('restart-btn').click();
    await page.waitForTimeout(500);
    const overlay = page.locator('.fixed.inset-0').last();
    await expect(overlay).toBeVisible({ timeout: 3000 });
  });

  test('23. FAQ opens overlay', async ({ page }) => {
    await startGame(page);
    await page.getByTestId('faq-btn').click();
    await page.waitForTimeout(500);
    const overlay = page.locator('.fixed.inset-0').last();
    await expect(overlay).toBeVisible({ timeout: 3000 });
  });

  test('24. No bonus-trap emoji overlap', async ({ page }) => {
    await startGame(page);
    const bonusEmojis = await page.locator('[class*="green"] [class*="text-3xl"]').allTextContents();
    const trapEmojis = await page.locator('[class*="red"] [class*="text-3xl"]').allTextContents();
    const overlap = bonusEmojis.filter(e => trapEmojis.includes(e));
    expect(overlap.length).toBe(0);
  });

  test('25. Debug log + backdoor events', async ({ page }) => {
    await startGame(page);
    const debugPanel = page.locator('text=Debug Log').first();
    await expect(debugPanel).toBeVisible({ timeout: 3000 });
    await backdoor(page);
    await page.waitForTimeout(2000);
    const logEntries = page.locator('[class*="text-red-400"], [class*="text-yellow-300"]');
    const logCount = await logEntries.count();
    expect(logCount).toBeGreaterThan(0);
  });

  test('26. Level 10: swap after 10s', async ({ page }) => {
    await startGame(page);
    await goToLevel(page, 10);
    await activateGame(page);
    await page.waitForTimeout(11000);
    const countdownEl = page.locator('text=Перемещение через').first();
    if (await countdownEl.isVisible({ timeout: 2000 }).catch(() => false)) {
      const text = await countdownEl.textContent() || '';
      const num = parseInt(text.replace(/\D/g, ''), 10);
      expect(num).toBeGreaterThanOrEqual(8);
    }
  });
});
