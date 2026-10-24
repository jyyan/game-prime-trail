import { expect, test } from '@playwright/test';
import { board, cell, fillByTrail, pickOnHome, readRecords, solutionOf, waitReady } from './helpers';

// Spec §12.3 scenario 1: home → play → solve by trail → win → cleared mark survives reload.
test('main flow: start from home, solve level 1 easy by trail, cleared mark persists', async ({ page }) => {
  await page.goto('/');
  await waitReady(page);
  await pickOnHome(page, 1, 'easy');
  await page.locator('[data-action="start"]').click();
  await expect(page).toHaveURL(/\/play\/1\/easy$/);
  await expect(board(page)).toBeVisible();

  const path = await solutionOf(page, 1);
  await fillByTrail(page, 1, 99);
  // The win must show a non-zero time: let the clock pass one second before the last cell.
  await expect(page.locator('[data-summary]')).not.toContainText('00:00');
  await cell(page, path[99]).click();

  const modal = page.locator('.modal');
  await expect(modal).toContainText('過關！');
  await expect(modal.locator('[data-time]')).not.toContainText('00:00');
  const stepsText = await modal.locator('[data-steps]').innerText();
  const steps = Number(/(\d+)/.exec(stepsText)?.[1]);
  expect(steps).toBeGreaterThan(0);
  expect((await readRecords(page))['1:easy']?.clears).toBe(1);

  await modal.locator('[data-action="backHome"]').click();
  await expect(page).toHaveURL(/\/$/);
  await waitReady(page);
  await page.locator('[data-level-id]').fill('1');
  await expect(page.locator('[data-difficulty="easy"] [data-completion="cleared"]')).toBeVisible();

  await page.reload();
  await waitReady(page);
  await page.locator('[data-level-id]').fill('1');
  await expect(page.locator('[data-difficulty="easy"] [data-completion="cleared"]')).toBeVisible();
});
