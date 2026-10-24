import { expect, test, type Locator } from '@playwright/test';
import { confirmOk, menuAction, openPlay } from './helpers';

// GAME-21 / spec §6.8, §9: the solution board must fit inside the solution dialog on every width.
const TOLERANCE = 1;

async function expectInside(inner: Locator, outer: Locator): Promise<void> {
  const a = await inner.boundingBox();
  const b = await outer.boundingBox();
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  expect(a!.x).toBeGreaterThanOrEqual(b!.x - TOLERANCE);
  expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x + b!.width + TOLERANCE);
}

test('solution board stays inside the solution dialog', async ({ page }) => {
  await openPlay(page, 1, 'easy');

  await menuAction(page, 'viewSolution');
  await confirmOk(page);

  const solution = page.locator('.modal .pt-solution');
  await expect(solution).toBeVisible();
  const content = page.locator('.modal .modal-content', { has: page.locator('.pt-solution') });
  const solutionBoard = solution.locator('.pt-board');
  await expect(solutionBoard).toBeVisible();

  await expectInside(solutionBoard, content);

  await solution.locator('[data-view="reference"]').click();
  await expect(solution.locator('[data-view="reference"]')).toHaveAttribute('aria-pressed', 'true');
  await expectInside(solutionBoard, content);

  await solution.locator('[data-view="mine"]').click();
  await expect(solution.locator('[data-view="mine"]')).toHaveAttribute('aria-pressed', 'true');
  await expectInside(solutionBoard, content);
});
