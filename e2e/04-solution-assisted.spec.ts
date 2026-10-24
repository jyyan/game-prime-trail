import { expect, test } from '@playwright/test';
import { confirmDialog, confirmOk, fillByTrail, openPlay, pickOnHome, readRecords, waitReady } from './helpers';

// Spec §12.3 scenario 4 / §7.4: viewing the solution marks the game assisted; an assisted win
// counts in assistedClears but never sets a best, and home shows the hollow "assisted" mark.
test('view solution: confirm, solution shown, assisted win recorded without best', async ({ page }) => {
  await openPlay(page, 1, 'easy');

  await page.locator('[data-action="viewSolution"]').click();
  await expect(confirmDialog(page)).toContainText('看過解答後，這局不列入最佳紀錄。');
  await confirmOk(page);

  const solution = page.locator('.modal .pt-solution');
  await expect(solution).toBeVisible();
  await expect(solution.locator('.pt-board')).toBeVisible();
  await expect(solution.locator('[data-view="reference"]')).toHaveAttribute('aria-pressed', 'true');
  // The reference board shows every number, 100 included.
  await expect(solution.locator('.pt-cell', { hasText: /^100$/ })).toHaveCount(1);
  // Not solved yet, so "your solution is also valid" must not appear.
  await expect(page.locator('[data-also-valid]')).toHaveCount(0);
  await page.locator('.modal .btn-close').click();
  await expect(page.locator('.modal')).toHaveCount(0);
  await expect(page.locator('[data-assisted]')).toBeVisible();

  await fillByTrail(page, 1);
  const win = page.locator('.modal');
  await expect(win).toContainText('輔助完成');
  await expect(win.locator('[data-new-best]')).toHaveCount(0);

  const entry = (await readRecords(page))['1:easy'];
  expect(entry?.assistedClears).toBe(1);
  expect(entry?.clears).toBe(0);
  expect(entry?.bestMs).toBeNull();
  expect(entry?.bestSteps).toBeNull();

  await win.locator('[data-action="backHome"]').click();
  await expect(page).toHaveURL(/\/$/);
  await waitReady(page);
  await pickOnHome(page, 1, 'easy');
  const mark = page.locator('[data-difficulty="easy"] [data-completion="assisted"]');
  await expect(mark).toBeVisible();
  await expect(mark).toContainText('輔助完成');
});
