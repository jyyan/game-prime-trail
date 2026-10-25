import { expect, test, type Page } from '@playwright/test';
import { waitReady } from './helpers';

// GAME-35 / demo-playback spec §5, §8: the home page "how to play" demo dialog. Playback time is
// fast-forwarded with page.clock; real timers only drive the initial load.

/** Set PT_SHOT_DIR to save evidence screenshots (375／1280 px); nothing is written otherwise. */
const SHOT_DIR = process.env.PT_SHOT_DIR;

async function shoot(page: Page, name: string, projectName: string): Promise<void> {
  if (!SHOT_DIR || projectName !== 'desktop-chromium') return;
  const original = page.viewportSize();
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `${SHOT_DIR}/demo-${name}-${width}.png`, animations: 'disabled' });
  }
  if (original) await page.setViewportSize(original);
}

async function openHome(page: Page): Promise<void> {
  await page.goto('/');
  await waitReady(page);
  await expect(page.locator('[data-view="home"] .pt-level-picker')).toBeVisible();
}

const dialog = (page: Page) => page.locator('.modal [data-demo]');
const say = (page: Page) => page.locator('[data-demo-say]');

async function openDemo(page: Page): Promise<void> {
  await page.locator('button[data-action="demo"]').click();
  await expect(dialog(page)).toHaveAttribute('data-phase', 'ready');
  await expect(dialog(page).locator('.pt-board')).toBeVisible();
}

test('the demo button opens the dialog with the board and intro; Esc closes and refocuses it', async ({ page }) => {
  await openHome(page);
  const button = page.locator('button[data-action="demo"]');
  await expect(button).toBeVisible();
  const box = await button.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);

  await openDemo(page);
  await expect(say(page)).toContainText('從龍頭的 1 出發。');
  await expect(page.locator('[data-demo-info]')).toHaveText(/^第 \d+ 張地圖・簡單難度｜退回 \d+ 次$/);
  await expect(dialog(page).locator('.pt-cell')).toHaveCount(100);

  await page.keyboard.press('Escape');
  await expect(page.locator('.modal')).toHaveCount(0);
  await expect(button).toBeFocused();
  // Nothing about the demo is stored.
  const ui = await page.evaluate(() => window.localStorage.getItem('prime-trail:v1:ui'));
  expect(ui === null || !ui.includes('demo')).toBe(true);
});

test('the demo button stays visible with the rules card collapsed', async ({ page }) => {
  await openHome(page);
  await page.locator('button[data-action="toggleRules"]').click();
  await expect(page.locator('[data-rules-body]')).toBeHidden();
  await expect(page.locator('button[data-action="demo"]')).toBeVisible();
});

test('at 320px the open dialog keeps the whole board on screen without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await openHome(page);
  await openDemo(page);
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  const board = await dialog(page).locator('.pt-board').boundingBox();
  expect(board!.x).toBeGreaterThanOrEqual(0);
  expect(board!.x + board!.width).toBeLessThanOrEqual(320);
  const modalScroll = await page.locator('.modal').evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(modalScroll).toBeLessThanOrEqual(0);
});

test('fast-forwarded playback: stuck reasons with marks, then the finished trail', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await openHome(page);
  await page.clock.install();
  await openDemo(page);

  await page.clock.runFor(4_000);
  await expect(dialog(page).locator('.pt-cell.is-filled').first()).toBeVisible();
  await shoot(page, 'playing', testInfo.project.name);

  // Step until a stuck message with both a ✕ neighbour and a red-framed cell is on screen; a map
  // whose stuck reasons are all local (no frame) is swapped for another one.
  let found = false;
  for (let map = 0; map < 6 && !found; map++) {
    if (map > 0) {
      await page.locator('button[data-action="demoAgain"]').click();
      await expect(say(page)).toContainText('從龍頭的 1 出發。');
    }
    for (let i = 0; i < 800; i++) {
      await page.clock.runFor(500);
      if ((await dialog(page).getAttribute('data-done')) === 'true') break;
      const lines = await page.locator('[data-demo-lines] li').count();
      const traps = await dialog(page).locator('.pt-cell.is-mark-trap').count();
      if (lines > 0 && traps > 0) {
        found = true;
        break;
      }
    }
  }
  expect(found).toBe(true);
  await expect(say(page)).toContainText('之後卡住了');
  await expect(dialog(page).locator('.pt-cell.is-mark-reject').first()).toBeVisible();
  const marker = await dialog(page)
    .locator('.pt-cell.is-mark-reject')
    .first()
    .evaluate((el) => getComputedStyle(el, '::after').content);
  expect(marker).toContain('✕');
  await shoot(page, 'stuck', testInfo.project.name);

  await page.clock.runFor(400_000);
  await expect(dialog(page)).toHaveAttribute('data-done', 'true');
  await expect(say(page)).toContainText('完成！1 到 100 全部連起來了');
  await expect(dialog(page).locator('svg.pt-trail polyline')).toBeVisible();
  await shoot(page, 'done', testInfo.project.name);

  // "Another one" clears the line and starts over.
  await page.locator('button[data-action="demoAgain"]').click();
  await expect(dialog(page).locator('svg.pt-trail')).toHaveCount(0);
  await expect(say(page)).toContainText('從龍頭的 1 出發。');
});
