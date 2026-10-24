import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { confirmDialog, confirmOk, fillByTrail, openPlay } from './helpers';

// Spec §12.3 scenario 6 / §6.9: a plain export downloads a PDF and leaves `assisted` alone;
// ticking "include solution" mid-game asks first and, once confirmed, marks the game assisted.
test('pdf: plain export downloads a PDF; solution page mid-game needs confirm and marks assisted', async ({ page }) => {
  await openPlay(page, 1, 'easy');

  await page.locator('[data-action="exportPdf"]').click();
  const dialog = page.locator('.modal', { has: page.locator('[data-include-solution]') });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-include-solution]')).not.toBeChecked();
  const downloadPromise = page.waitForEvent('download');
  await dialog.locator('[data-action="export"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^prime-trail-0001-easy\.pdf$/);
  const file = await download.path();
  const bytes = await readFile(file);
  expect(bytes.subarray(0, 4).toString('latin1')).toBe('%PDF');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-assisted]')).toHaveCount(0);

  // One cell in: the game is in play, so the solution page now costs the record.
  await fillByTrail(page, 1, 100, 1);
  await page.locator('[data-action="exportPdf"]').click();
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-include-solution]').check();
  await expect(confirmDialog(page)).toContainText('匯出含解答的 PDF 後，這局不列入最佳紀錄。');
  await confirmOk(page);
  await expect(dialog.locator('[data-include-solution]')).toBeChecked();
  await expect(page.locator('[data-assisted]')).toBeVisible();
});
