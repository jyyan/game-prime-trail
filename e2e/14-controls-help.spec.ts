import { expect, test, type Page } from '@playwright/test';
import { board, cell, filledCount, isMobileProject, openPlay, solutionOf } from './helpers';

// GAME-29 / controls-help spec §4–§5, §7: the first-time controls hint and the top bar's help
// dialog. playwright.config.ts marks the hint as seen for every other spec; these start clean.
test.use({ storageState: { cookies: [], origins: [] } });

const UI_KEY = 'prime-trail:v1:ui';

/** Set PT_SHOT_DIR to save evidence screenshots; nothing is written otherwise. */
const SHOT_DIR = process.env.PT_SHOT_DIR;

async function shoot(page: Page, name: string, width: number): Promise<void> {
  if (!SHOT_DIR) return;
  const original = page.viewportSize();
  await page.setViewportSize({ width, height: original?.height ?? 900 });
  await page.screenshot({ path: `${SHOT_DIR}/game29-${name}-${width}.png`, animations: 'disabled' });
  if (original && original.width !== width) await page.setViewportSize(original);
}

const hint = (page: Page) => page.locator('[data-view="play"] [data-controls-hint]');
const helpButton = (page: Page) => page.locator('[data-view="play"] [data-action="help"]');
const helpDialog = (page: Page) => page.locator('.modal', { has: page.locator('[data-help-section]') });

/** Arrow key that moves from cell `from` to the adjacent cell `to` on the 10×10 board. */
function arrowBetween(from: number, to: number): string {
  const d = to - from;
  if (d === 1) return 'ArrowRight';
  if (d === -1) return 'ArrowLeft';
  if (d === 10) return 'ArrowDown';
  if (d === -10) return 'ArrowUp';
  throw new Error(`cells ${from} and ${to} are not adjacent`);
}

async function storedUi(page: Page): Promise<unknown> {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? 'null') as unknown, UI_KEY);
}

test('desktop: keyboard hint, one arrow fills a cell and hides it for good', async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo), 'mouse and keyboard run in the desktop project');

  // Challenge shows only 1, so the cell of 2 is empty and one arrow away from the head.
  await openPlay(page, 1, 'challenge');
  await expect(hint(page)).toBeVisible();
  await expect(hint(page)).toContainText('方向鍵');
  await expect(hint(page).locator('kbd', { hasText: 'Backspace' })).toBeVisible();
  await expect(hint(page)).not.toContainText('拖曳');
  // The board keeps focus with the hint showing.
  await expect(board(page)).toBeFocused();
  await shoot(page, 'hint-desktop', 1280);

  const path = await solutionOf(page, 1);
  await page.keyboard.press(arrowBetween(path[0], path[1]));
  await expect(cell(page, path[1])).toHaveText('2');
  await expect(hint(page)).toHaveCount(0);
  expect(await storedUi(page)).toMatchObject({ controlsHintSeen: true });

  await page.reload();
  await expect(board(page)).toBeVisible();
  await expect(cell(page, path[1])).toHaveText('2');
  await expect(hint(page)).toHaveCount(0);
});

test('mobile: drag hint, one drag step fills a cell and hides it', async ({ page }, testInfo) => {
  test.skip(!isMobileProject(testInfo), 'touch runs in the mobile project only');

  await openPlay(page, 1, 'challenge');
  await expect(hint(page)).toBeVisible();
  await expect(hint(page)).toContainText('拖曳');
  await expect(hint(page).locator('kbd')).toHaveCount(0);
  await shoot(page, 'hint-mobile', 375);

  const path = await solutionOf(page, 1);
  await cell(page, path[0]).scrollIntoViewIfNeeded();
  const centre = async (c: number) => {
    const box = await cell(page, c).boundingBox();
    if (!box) throw new Error(`cell ${c} has no box`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const from = await centre(path[0]);
  const to = await centre(path[1]);
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', p?: { x: number; y: number }) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: p ? [{ x: p.x, y: p.y, id: 1, radiusX: 2, radiusY: 2, force: 1 }] : [],
    });
  await touch('touchStart', from);
  for (const f of [0.25, 0.5, 0.75, 1]) await touch('touchMove', { x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f });
  await touch('touchEnd');

  await expect(cell(page, path[1])).toHaveText('2');
  await expect(hint(page)).toHaveCount(0);
  expect(await storedUi(page)).toMatchObject({ controlsHintSeen: true });

  // Help is still one tap away; on touch the touch section comes first.
  await page.setViewportSize({ width: 375, height: page.viewportSize()?.height ?? 800 });
  await helpButton(page).tap();
  await expect(helpDialog(page)).toBeVisible();
  await expect(helpDialog(page).locator('[data-help-section]').first()).toHaveAttribute('data-help-section', 'touch');
  await shoot(page, 'help-mobile', 375);
});

test('help opens and closes from the keyboard, returns focus, and blocks board keys', async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo), 'keyboard runs in the desktop project');

  await openPlay(page, 1, 'challenge');
  await expect(hint(page)).toBeVisible();
  const before = await filledCount(page);

  await helpButton(page).focus();
  await page.keyboard.press('Enter');
  await expect(helpDialog(page)).toBeVisible();
  await expect(helpDialog(page).locator('[data-help-section]').first()).toHaveAttribute('data-help-section', 'pointer');
  // Opening help counts as having seen the hint.
  await expect(hint(page)).toHaveCount(0);
  await shoot(page, 'help-desktop', 1280);
  await shoot(page, 'help-desktop', 375);

  for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) await page.keyboard.press(key);
  expect(await filledCount(page)).toBe(before);

  await page.keyboard.press('Escape');
  await expect(helpDialog(page)).toHaveCount(0);
  await expect(helpButton(page)).toBeFocused();
  expect(await filledCount(page)).toBe(before);
});

test.describe('320px wide', () => {
  test.use({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });

  test('the hint fits: no horizontal scroll, board not clipped, top bar targets ≥ 44px', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'viewport is fixed; run once');

    await openPlay(page, 1, 'easy');
    await expect(hint(page)).toBeVisible();
    await shoot(page, 'hint-320', 320);

    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBe(innerWidth);

    const boardBox = (await board(page).boundingBox())!;
    const wrapBox = (await page.locator('.pt-play__board-wrap').boundingBox())!;
    expect(boardBox.x).toBeGreaterThanOrEqual(-1);
    expect(boardBox.x + boardBox.width).toBeLessThanOrEqual(320 + 1);
    expect(boardBox.y + boardBox.height).toBeLessThanOrEqual(wrapBox.y + wrapBox.height + 1);
    // The hint sits above the board, not on it.
    const hintBox = (await hint(page).boundingBox())!;
    expect(hintBox.y + hintBox.height).toBeLessThanOrEqual(boardBox.y + 1);
    expect(hintBox.x + hintBox.width).toBeLessThanOrEqual(320 + 1);

    const home = (await page.locator('[data-view="play"] [data-action="home"]').boundingBox())!;
    const help = (await helpButton(page).boundingBox())!;
    for (const b of [home, help]) {
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
    // One row: the help button sits level with the home button, inside the viewport.
    expect(Math.abs(help.y - home.y)).toBeLessThanOrEqual(2);
    expect(help.x + help.width).toBeLessThanOrEqual(320 + 1);
  });
});
