import { expect, test } from '@playwright/test';

const DEEP_LINK = '/play/500/challenge';

// Spec §12.3 scenario 7 / §11: a deep link opens the play view directly. The dev server runs it in
// the desktop and mobile projects; the `wrangler` project runs it against the production build
// behind `wrangler dev` to check `not_found_handling: single-page-application`.
test('spa fallback: deep link opens the board', async ({ page }, testInfo) => {
  const response = await page.goto(DEEP_LINK);
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(`${DEEP_LINK}$`));
  await expect(page.locator('[data-view="play"] .pt-board')).toBeVisible();
  await expect(page.locator('[data-summary]')).toContainText('#0500');
  if (testInfo.project.name === 'wrangler') {
    // The production build has no E2E hooks.
    expect(await page.evaluate(() => window.__primeTrail === undefined)).toBe(true);
  }
});
