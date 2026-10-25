import { expect, test, type Page } from '@playwright/test';
import { board, cell, dismissToasts, fillByTrail, openPlay, solutionOf } from './helpers';

// Demo-playback spec §6 (dead-end hint on easy) and §5.4 (completed line after a win).

const isPrime = (n: number): boolean => {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
};
const rowOf = (c: number): number => Math.floor(c / 10);
const colOf = (c: number): number => c % 10;
const manhattan = (a: number, b: number): number => Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b));
const neighbours = (c: number): number[] =>
  [c - 10, c + 10, colOf(c) > 0 ? c - 1 : -1, colOf(c) < 9 ? c + 1 : -1].filter((x) => x >= 0 && x < 100);

/**
 * A one-step detour on the easy board (1 and every prime shown) that leaves the next prime out of
 * reach ("far"): fill the reference path to k, then put k+1 on `cell` instead of path[k].
 */
function farDetour(path: readonly number[]): { k: number; cell: number } {
  const grey = new Set(path.filter((_, i) => isPrime(i + 1)));
  for (let k = 2; k < 98; k++) {
    if (isPrime(k + 1) || isPrime(k + 2)) continue;
    let v = k + 2;
    while (!isPrime(v)) v++;
    const used = new Set(path.slice(0, k));
    for (const x of neighbours(path[k - 1])) {
      if (x === path[k] || used.has(x) || grey.has(x)) continue;
      if (manhattan(x, path[v - 1]) > v - (k + 1)) return { k, cell: x };
    }
  }
  throw new Error('no far detour on this map');
}

async function makeDeadEnd(page: Page): Promise<number> {
  await openPlay(page, 1, 'easy');
  const path = await solutionOf(page, 1);
  const { k, cell: x } = farDetour(path);
  await fillByTrail(page, 1, k);
  await cell(page, x).click();
  await expect(cell(page, x)).toHaveText(String(k + 1));
  return x;
}

test('easy: a doomed move shows ✕ and the reason line; undo removes both', async ({ page }) => {
  const x = await makeDeadEnd(page);
  const line = page.locator('[data-view="play"] [data-dead-end]');
  await expect(line).toBeVisible();
  await expect(line).toContainText('走不到了');
  await expect(cell(page, x)).toHaveClass(/is-mark-reject/);
  await expect(board(page).locator('.pt-cell.is-mark-trap')).toHaveCount(1);

  await page.locator('[data-view="play"] [data-action="undo"]').click();
  await expect(cell(page, x)).toHaveText('');
  await expect(line).toHaveCount(0);
  await expect(board(page).locator('.is-mark-reject, .is-mark-trap')).toHaveCount(0);
});

test('a win draws the 1→100 line once the win dialog is closed', async ({ page }) => {
  await openPlay(page, 1, 'easy');
  await expect(board(page).locator('svg.pt-trail')).toHaveCount(0);
  await fillByTrail(page, 1, 100);
  const modal = page.locator('.modal', { hasText: '過關！' });
  await expect(modal).toBeVisible();
  await modal.locator('.btn-close').click();
  await expect(modal).toBeHidden();
  await dismissToasts(page);
  const line = board(page).locator('svg.pt-trail polyline');
  await expect(line).toBeVisible();
  expect((await line.getAttribute('points'))?.trim().split(/\s+/)).toHaveLength(100);
  await expect(board(page).locator('.pt-num-corner').first()).toBeVisible();
});

test.describe('320px wide', () => {
  test.use({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });

  test('the reason line does not cause horizontal scrolling', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'viewport is fixed; run once');
    await makeDeadEnd(page);
    await expect(page.locator('[data-view="play"] [data-dead-end]')).toBeVisible();
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  });
});
