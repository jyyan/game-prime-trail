import { expect, test, type Page } from '@playwright/test';
import {
  board,
  cell,
  fillByTrail,
  filledCount,
  givenCells,
  moreMenu,
  openPlay,
  solutionOf,
  trailModeButton,
  waitReady,
} from './helpers';

// UI refresh spec §4.1–§4.3, §5.1 and plan Review Focus 1, 2, 5.

const moreButton = (page: Page) => page.locator('[data-view="play"] [data-action="more"]');

async function boardFocusVisible(page: Page): Promise<boolean> {
  return board(page).evaluate((el) => el.matches(':focus-visible'));
}

async function boardFocused(page: Page): Promise<boolean> {
  return board(page).evaluate((el) => el === document.activeElement);
}

test('top bar shows map, difficulty and timer; home keeps the move made just before', async ({ page }) => {
  await openPlay(page, 3, 'advanced');
  await expect(page.locator('[data-level-title]')).toHaveText('地圖 #0003・進階');
  await expect(page.locator('[data-timer]')).toHaveText(/^\d\d:\d\d$/);

  // Review Focus 2: no wait for the debounced autosave; leaving must flush it.
  const [filled] = await fillByTrail(page, 3, 100, 1);
  const value = await cell(page, filled).innerText();
  await page.locator('[data-action="home"]').click();
  await expect(page).toHaveURL(/\/$/);
  await waitReady(page);

  const resume = page.locator('[data-action="resume"]');
  await expect(resume).toContainText('#0003・進階');
  await resume.click();
  await expect(page).toHaveURL(/\/play\/3\/advanced$/);
  await expect(cell(page, filled)).toHaveText(value);
  await expect(page.locator('[data-steps]')).toHaveText('步數 1');
});

test('more menu: Enter opens, Esc closes and returns focus, outside click closes, board ignores keys', async ({
  page,
}) => {
  await openPlay(page, 1, 'challenge');
  const menu = moreMenu(page);
  const trigger = moreButton(page);

  // Review Focus 1: keyboard open／close and focus return.
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(menu.locator('[data-action="viewSolution"]')).toBeFocused();
  await expect(menu.locator('[role="menuitem"]')).toHaveText(['看解答', '匯出 PDF', '重新開始']);

  // While the menu is open the board gets no keys: arrows move within the menu only.
  const before = await filledCount(page);
  await page.keyboard.press('ArrowDown');
  await expect(menu.locator('[data-action="exportPdf"]')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Backspace');
  expect(await filledCount(page)).toBe(before);
  await expect(board(page)).toHaveAttribute('data-mode', 'trail');

  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  // Pointer: open by click, close by a click outside.
  await trigger.click();
  await expect(menu).toBeVisible();
  await page.locator('[data-level-title]').click();
  await expect(menu).toHaveCount(0);
});

test('trail mode shows the next number and it follows the head', async ({ page }) => {
  await openPlay(page, 1, 'easy');
  const path = await solutionOf(page, 1);
  const givens = await givenCells(page);
  const next = page.locator('.pt-status-bar [data-next-value]');

  // Head = the longest run 1…h already on the board; next is h + 1 (spec §4.3).
  let head = 1;
  while (givens.has(path[head])) head++;
  await expect(next).toHaveText(String(head + 1));

  await cell(page, path[head]).click();
  await expect(cell(page, path[head])).toHaveText(String(head + 1));
  let after = head + 1;
  while (after < 100 && givens.has(path[after])) after++;
  await expect(next).toHaveText(String(after + 1));

  await page.locator('[data-action="undo"]').click();
  await expect(next).toHaveText(String(head + 1));
});

test('direct mode shows pending in the status bar: 1 0 0 reads 100, a fourth key is refused visibly', async ({
  page,
}) => {
  await openPlay(page, 1, 'challenge');
  await trailModeButton(page, 'direct').click();
  const pad = page.locator('.pt-number-pad');
  const pending = page.locator('.pt-status-bar [data-pending]');
  const box = page.locator('.pt-status-bar [data-pending-box]');

  await expect(page.locator('.pt-status-bar [data-next]')).toHaveCount(0);
  await expect(pad.locator('[data-pending]')).toHaveCount(0);
  await expect(pending).toHaveText('');

  // Review Focus 5.
  for (const d of ['1', '0', '0']) await pad.locator(`[data-key="${d}"]`).click();
  await expect(pending).toHaveText('100');
  await expect(box).not.toHaveAttribute('data-rejected', 'true');
  await pad.locator('[data-key="7"]').click();
  await expect(pending).toHaveText('100');
  await expect(box).toHaveAttribute('data-rejected', 'true');
  await expect(box).not.toHaveAttribute('data-rejected', 'true');
});

test('board focus ring: none after load or a pointer press, shown after keyboard use', async ({ page }) => {
  await openPlay(page, 1, 'easy');
  await expect.poll(() => boardFocused(page)).toBe(true);
  expect(await boardFocusVisible(page)).toBe(false);

  const path = await solutionOf(page, 1);
  const givens = await givenCells(page);
  let head = 1;
  while (givens.has(path[head])) head++;
  await cell(page, path[head]).click();
  expect(await boardFocused(page)).toBe(true);
  expect(await boardFocusVisible(page)).toBe(false);

  // Tab on the board switches the input mode and keeps focus there, now as keyboard focus.
  await page.keyboard.press('Tab');
  await expect(board(page)).toHaveAttribute('data-mode', 'direct');
  expect(await boardFocused(page)).toBe(true);
  expect(await boardFocusVisible(page)).toBe(true);

  // Plain keyboard navigation: Shift+Tab leaves the board, Tab comes back with the ring.
  await page.keyboard.press('Shift+Tab');
  expect(await boardFocused(page)).toBe(false);
  await page.keyboard.press('Tab');
  expect(await boardFocused(page)).toBe(true);
  expect(await boardFocusVisible(page)).toBe(true);
});
