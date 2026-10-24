import { expect, test } from '@playwright/test';
import { board, cell, openPlay, solutionOf, trailModeButton } from './helpers';

// Spec §12.3 scenario 2: direct mode, two-digit entry, duplicate conflict, undo.
// Challenge shows only 1, so putting 12 on the reference cells of 12 and 14 (both even,
// non-prime, right parity, no neighbours filled) leaves the duplicate as the only conflict.
test('direct mode: two-digit entry, duplicate marks two cells, undo clears them', async ({ page }) => {
  await openPlay(page, 1, 'challenge');
  const path = await solutionOf(page, 1);
  const first = path[11];
  const second = path[13];

  await trailModeButton(page, 'direct').click();
  await expect(trailModeButton(page, 'direct')).toHaveAttribute('aria-pressed', 'true');

  const pad = page.locator('.pt-number-pad');
  await cell(page, first).click();
  await expect(cell(page, first)).toHaveClass(/is-selected/);
  await pad.locator('[data-key="1"]').click();
  await pad.locator('[data-key="2"]').click();
  await expect(pad.locator('[data-pending]')).toHaveText('12');
  await pad.locator('[data-key="confirm"]').click();
  await expect(cell(page, first)).toHaveText('12');
  await expect(board(page).locator('.is-conflict')).toHaveCount(0);

  await cell(page, second).click();
  await pad.locator('[data-key="1"]').click();
  await pad.locator('[data-key="2"]').click();
  await pad.locator('[data-key="confirm"]').click();
  await expect(cell(page, second)).toHaveText('12');
  const conflicts = board(page).locator('.is-conflict');
  await expect(conflicts).toHaveCount(2);
  await expect(cell(page, first)).toHaveClass(/is-conflict/);
  await expect(cell(page, second)).toHaveClass(/is-conflict/);

  await page.locator('[data-action="undo"]').click();
  await expect(cell(page, second)).toHaveText('');
  await expect(conflicts).toHaveCount(0);
});
