import { expect, test } from '@playwright/test';
import { board, cell, filledCount, openPlay, solutionOf, trailModeButton } from './helpers';

const ARROW_BY_DELTA: Readonly<Record<number, string>> = {
  [-10]: 'ArrowUp',
  10: 'ArrowDown',
  [-1]: 'ArrowLeft',
  1: 'ArrowRight',
};
const OPPOSITE: Readonly<Record<string, string>> = {
  ArrowUp: 'ArrowDown',
  ArrowDown: 'ArrowUp',
  ArrowLeft: 'ArrowRight',
  ArrowRight: 'ArrowLeft',
};

// Spec §12.3 scenario 8 / §7.3: an arrow extends the head, a blocked arrow leaves the board
// unchanged and shakes its target, Backspace takes the last cell back, Tab switches mode.
test('trail keyboard: arrow extends, blocked arrow shakes, Backspace retreats, Tab toggles', async ({ page }) => {
  await openPlay(page, 1, 'challenge');
  const path = await solutionOf(page, 1);
  const start = path[0];
  const two = path[1];
  const forward = ARROW_BY_DELTA[two - start];
  expect(forward).toBeDefined();

  await expect(trailModeButton(page, 'trail')).toHaveAttribute('aria-pressed', 'true');
  await board(page).focus();
  const before = await filledCount(page);

  await page.keyboard.press(forward);
  await expect(cell(page, two)).toHaveText('2');
  expect(await filledCount(page)).toBe(before + 1);

  // Back towards 1: that cell is filled, so the step is rejected and the target cell shakes.
  await page.keyboard.press(OPPOSITE[forward]);
  await expect(cell(page, start)).toHaveClass(/is-shake/);
  expect(await filledCount(page)).toBe(before + 1);
  await expect(cell(page, start)).not.toHaveClass(/is-shake/);

  await page.keyboard.press('Backspace');
  await expect(cell(page, two)).toHaveText('');
  expect(await filledCount(page)).toBe(before);

  await page.keyboard.press('Tab');
  await expect(trailModeButton(page, 'direct')).toHaveAttribute('aria-pressed', 'true');
  await expect(board(page)).toHaveAttribute('data-mode', 'direct');
});
