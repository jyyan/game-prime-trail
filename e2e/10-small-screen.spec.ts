import { expect, test } from '@playwright/test';
import { board, fillByTrail, openPlay } from './helpers';

// GAME-22 / spec §6.1–§6.3, §9: on a 320px-wide phone the play board must fit the viewport
// and the page must not scroll horizontally. The viewport is fixed here, so one project is enough.
const WIDTH = 320;
const TOLERANCE = 1;

test.use({ viewport: { width: WIDTH, height: 640 }, hasTouch: true, isMobile: true });

test('play board fits a 320px-wide viewport and stays interactive', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'viewport is fixed; run once');

  await openPlay(page, 1, 'easy');

  const box = await board(page).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-TOLERANCE);
  expect(box!.x + box!.width).toBeLessThanOrEqual(WIDTH + TOLERANCE);

  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);

  const clicked = await fillByTrail(page, 1, 100, 3);
  expect(clicked).toHaveLength(3);
});
