/// <reference lib="dom" />
import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

declare global {
  interface Window {
    /** Test hooks installed by `src/e2e-hooks.ts` when served with `VITE_E2E=1`. */
    __primeTrail?: {
      solutionOf(id: number): number[];
      ready(): Promise<void>;
    };
  }
}

export type Difficulty = 'easy' | 'advanced' | 'challenge';

/** Storage prefix for format v1 / library v1 (spec §7.5). */
export const STORAGE_PREFIX = 'prime-trail:v1:L1:';

export interface RecordEntry {
  bestMs: number | null;
  bestSteps: number | null;
  clears: number;
  assistedClears: number;
  lastClearedAt: string;
}

export interface SavedProgress {
  grid: number[];
  steps: number;
  elapsedMs: number;
  assisted: boolean;
  inputMode: 'trail' | 'direct';
  savedAt: string;
}

export function isMobileProject(testInfo: TestInfo): boolean {
  return testInfo.project.name.startsWith('mobile');
}

/** Waits for the E2E hooks and the level library (spec §12.3). */
export async function waitReady(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__primeTrail !== undefined);
  await page.evaluate(() => window.__primeTrail!.ready());
}

export function board(page: Page): Locator {
  return page.locator('[data-view="play"] .pt-board');
}

export function cell(page: Page, c: number): Locator {
  return board(page).locator(`.pt-cell[data-cell="${c}"]`);
}

/** Opens `/play/:id/:difficulty` and waits until the board is interactive. */
export async function openPlay(page: Page, id: number, difficulty: Difficulty): Promise<void> {
  await page.goto(`/play/${id}/${difficulty}`);
  await waitReady(page);
  await expect(board(page)).toBeVisible();
}

/** Reference path of level `id`: element k-1 is the cell holding k. */
export async function solutionOf(page: Page, id: number): Promise<number[]> {
  await waitReady(page);
  return page.evaluate((levelId) => window.__primeTrail!.solutionOf(levelId), id);
}

/** Cells locked as givens on the current board. */
export async function givenCells(page: Page): Promise<Set<number>> {
  const ids = await board(page)
    .locator('.pt-cell.is-given')
    .evaluateAll((els) => els.map((el) => Number((el as HTMLElement).dataset.cell)));
  return new Set(ids);
}

/** Number of cells currently showing a value. */
export async function filledCount(page: Page): Promise<number> {
  return board(page)
    .locator('.pt-cell')
    .evaluateAll((els) => els.filter((el) => (el.textContent ?? '').trim() !== '').length);
}

export function trailModeButton(page: Page, mode: 'trail' | 'direct'): Locator {
  return page.locator(`button[data-mode="${mode}"]`);
}

/**
 * Trail mode: clicks the reference path's cells in order for numbers 2…upTo, skipping givens.
 * `maxCells` stops after that many clicks. Returns the clicked cells in order.
 */
export async function fillByTrail(
  page: Page,
  id: number,
  upTo = 100,
  maxCells = Number.POSITIVE_INFINITY,
): Promise<number[]> {
  const path = await solutionOf(page, id);
  const givens = await givenCells(page);
  const clicked: number[] = [];
  for (let n = 2; n <= upTo && clicked.length < maxCells; n++) {
    const c = path[n - 1];
    if (givens.has(c)) continue;
    await cell(page, c).click();
    await expect(cell(page, c)).toHaveText(String(n));
    clicked.push(c);
  }
  return clicked;
}

async function readJson<T>(page: Page, name: string): Promise<T | null> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  }, STORAGE_PREFIX + name) as Promise<T | null>;
}

export async function readRecords(page: Page): Promise<Record<string, RecordEntry>> {
  return (await readJson<Record<string, RecordEntry>>(page, 'records')) ?? {};
}

export async function readProgress(page: Page): Promise<Record<string, SavedProgress>> {
  return (await readJson<Record<string, SavedProgress>>(page, 'progress')) ?? {};
}

/** Home page: types the level id and picks the difficulty (does not press start). */
export async function pickOnHome(page: Page, id: number, difficulty: Difficulty): Promise<void> {
  await page.locator('[data-level-id]').fill(String(id));
  await page.locator(`[data-difficulty="${difficulty}"]`).click();
}

/** The confirm dialog (BsConfirmHost); it may stack above another modal. */
export function confirmDialog(page: Page): Locator {
  return page.locator('.modal', { has: page.locator('[data-confirm="ok"]') });
}

/** Accepts the pending confirm dialog (BsConfirmHost). */
export async function confirmOk(page: Page): Promise<void> {
  await page.locator('.modal [data-confirm="ok"]').click();
  await expect(page.locator('.modal [data-confirm="ok"]')).toHaveCount(0);
}

/** Closes every visible toast so it cannot cover controls near the bottom edge. */
export async function dismissToasts(page: Page): Promise<void> {
  const closers = page.locator('.toast .btn-close');
  while ((await closers.count()) > 0) await closers.first().click();
}

/** The play view's "more" menu (UI refresh spec §4.2). */
export function moreMenu(page: Page): Locator {
  return page.locator('[data-view="play"] [role="menu"][data-menu="more"]');
}

/** Opens the action bar's "more" menu and picks `action` (view solution, PDF or restart). */
export async function menuAction(page: Page, action: 'viewSolution' | 'exportPdf' | 'restart'): Promise<void> {
  await page.locator('[data-view="play"] [data-action="more"]').click();
  await moreMenu(page).locator(`[data-action="${action}"]`).click();
}
