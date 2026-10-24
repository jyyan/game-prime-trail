import { expect, test } from '@playwright/test';
import { cell, filledCount, isMobileProject, openPlay, solutionOf, trailModeButton } from './helpers';

const DRAG_CELLS = 5;

// Spec §12.3 scenario 3 / §9: on a touch phone, one trail drag fills consecutive cells and the
// page does not scroll while dragging (`touch-action: none` on the board).
test('mobile: one touch drag fills five cells without scrolling the page', async ({ page }, testInfo) => {
  test.skip(!isMobileProject(testInfo), 'touch drag runs in the mobile project only');

  // Challenge shows only 1, so cells 2…6 of the reference path are all empty.
  await openPlay(page, 1, 'challenge');
  await expect(trailModeButton(page, 'trail')).toHaveAttribute('aria-pressed', 'true');
  const path = await solutionOf(page, 1);
  const route = path.slice(0, DRAG_CELLS + 1);

  await cell(page, route[0]).scrollIntoViewIfNeeded();
  const centers: { x: number; y: number }[] = [];
  for (const c of route) {
    const box = await cell(page, c).boundingBox();
    if (!box) throw new Error(`cell ${c} has no box`);
    centers.push({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
  }
  const before = await filledCount(page);
  const scrollBefore = await page.evaluate(() => window.scrollY);

  // Real touch input through CDP, so the browser applies touch-action and pointer capture.
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', p?: { x: number; y: number }) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: p ? [{ x: p.x, y: p.y, id: 1, radiusX: 2, radiusY: 2, force: 1 }] : [],
    });

  await touch('touchStart', centers[0]);
  const scrollDuring: number[] = [];
  for (let i = 1; i < centers.length; i++) {
    const from = centers[i - 1];
    const to = centers[i];
    // Several moves per cell, like a finger sliding across it.
    for (const f of [0.25, 0.5, 0.75, 1]) {
      await touch('touchMove', { x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f });
    }
    scrollDuring.push(await page.evaluate(() => window.scrollY));
  }
  await touch('touchEnd');

  for (let i = 1; i < route.length; i++) await expect(cell(page, route[i])).toHaveText(String(i + 1));
  expect(await filledCount(page)).toBe(before + DRAG_CELLS);
  for (const y of scrollDuring) expect(y).toBe(scrollBefore);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
});
