import { expect, test, type Page } from '@playwright/test';
import {
  board,
  cell,
  confirmDialog,
  confirmOk,
  dismissToasts,
  fillByTrail,
  filledCount,
  givenCells,
  openPlay,
  pickOnHome,
  readProgress,
  solutionOf,
  waitReady,
} from './helpers';

/** Waits for the debounced autosave (spec §7.6) to hold `steps` for `key`. */
async function waitSaved(page: Page, key: string, steps: number): Promise<void> {
  await expect.poll(async () => (await readProgress(page))[key]?.steps ?? null).toBe(steps);
}

async function expectCells(page: Page, cells: number[], numbers: Map<number, number>): Promise<void> {
  for (const c of cells) await expect(cell(page, c)).toHaveText(String(numbers.get(c)));
}

function numbersOf(path: number[]): Map<number, number> {
  return new Map(path.map((c, i) => [c, i + 1]));
}

// Spec §12.3 scenario 5 / §7.6: reload on the same URL restores the board, steps and a toast;
// "restart" clears the board and deletes the save.
test('restore: reload keeps the board and steps, restart clears it and its save', async ({ page }) => {
  await openPlay(page, 1, 'easy');
  const path = await solutionOf(page, 1);
  const numbers = numbersOf(path);
  const givenCount = (await givenCells(page)).size;
  const filled = await fillByTrail(page, 1, 100, 5);
  expect(filled).toHaveLength(5);
  await waitSaved(page, '1:easy', 5);

  await page.reload();
  await waitReady(page);
  await expect(board(page)).toBeVisible();
  await expectCells(page, filled, numbers);
  await expect(page.locator('[data-summary]')).toContainText('步數 5');
  await expect(page.locator('.toast')).toContainText('已恢復進度');

  await dismissToasts(page);
  await page.locator('[data-action="restart"]').click();
  await expect(confirmDialog(page)).toContainText('清除目前盤面並重新計時？');
  await confirmOk(page);
  for (const c of filled) await expect(cell(page, c)).toHaveText('');
  expect(await filledCount(page)).toBe(givenCount);
  await expect(page.locator('[data-summary]')).toContainText('步數 0');
  await expect.poll(async () => '1:easy' in (await readProgress(page))).toBe(false);
});

// Spec §12.3 scenario 5b: home "continue" points at the last game; "start" on the same map resumes too.
test('restore: home "continue" and "start" both resume the saved game', async ({ page }) => {
  await openPlay(page, 2, 'advanced');
  const numbers = numbersOf(await solutionOf(page, 2));
  const filled = await fillByTrail(page, 2, 100, 3);
  expect(filled).toHaveLength(3);
  await waitSaved(page, '2:advanced', 3);

  await page.goto('/');
  await waitReady(page);
  const resume = page.locator('[data-action="resume"]');
  await expect(resume).toContainText('#0002・進階');
  await resume.click();
  await expect(page).toHaveURL(/\/play\/2\/advanced$/);
  await expectCells(page, filled, numbers);
  await expect(page.locator('.toast')).toContainText('已恢復進度');

  await page.goto('/');
  await waitReady(page);
  await pickOnHome(page, 2, 'advanced');
  await page.locator('[data-action="start"]').click();
  await expect(page).toHaveURL(/\/play\/2\/advanced$/);
  await expectCells(page, filled, numbers);
  await expect(page.locator('[data-summary]')).toContainText('步數 3');
});
