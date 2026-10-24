import { expect, test, type Page } from '@playwright/test';
import { waitReady } from './helpers';

// GAME-25 / UI refresh spec §4.4, §5.2: home hero, rules card, difficulty hints, the empty id
// field without an error (Review Focus 4, backlog R30) and the missing-library illustration.

const UI_KEY = 'prime-trail:v1:ui';

/** Set PT_SHOT_DIR to save evidence screenshots (375／1280 px); nothing is written otherwise. */
const SHOT_DIR = process.env.PT_SHOT_DIR;

async function shoot(page: Page, name: string, projectName: string): Promise<void> {
  if (!SHOT_DIR || projectName !== 'desktop-chromium') return;
  const original = page.viewportSize();
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `${SHOT_DIR}/home-${name}-${width}.png`, fullPage: true, animations: 'disabled' });
  }
  if (original) await page.setViewportSize(original);
}

async function openHome(page: Page): Promise<void> {
  await page.goto('/');
  await waitReady(page);
  await expect(page.locator('[data-view="home"] .pt-level-picker')).toBeVisible();
}

async function imageLoaded(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).evaluate((el) => {
    const img = el as HTMLImageElement;
    return img.complete && img.naturalWidth > 0;
  });
}

async function noHorizontalScroll(page: Page): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
});

test('empty id field disables start without an error; an invalid value errors only after blur', async ({
  page,
}, testInfo) => {
  await openHome(page);
  const field = page.locator('[data-level-id]');
  const start = page.locator('button[data-action="start"]');
  const error = page.locator('[data-invalid-id]');

  await expect(start).toBeDisabled();
  await expect(error).toHaveCount(0);
  await expect(field).toHaveAttribute('aria-invalid', 'false');
  await shoot(page, 'empty', testInfo.project.name);

  // Focusing and leaving the empty field still shows nothing.
  await field.focus();
  await field.blur();
  await expect(error).toHaveCount(0);

  // An out-of-range value waits for blur.
  await field.fill('0');
  await expect(start).toBeDisabled();
  await expect(error).toHaveCount(0);
  await field.blur();
  await expect(error).toBeVisible();
  await expect(field).toHaveAttribute('aria-invalid', 'true');

  // Typing again hides it; a valid id enables start.
  await field.fill('1');
  await expect(error).toHaveCount(0);
  await field.blur();
  await expect(error).toHaveCount(0);
  await expect(start).toBeEnabled();

  // Enter on an invalid value also reveals the message without navigating.
  await field.fill('99999');
  await field.press('Enter');
  await expect(error).toBeVisible();
  await expect(page.locator('[data-view="home"]')).toBeVisible();
});

test('hero, rules and difficulty hints render; selecting an id and difficulty starts the game', async ({
  page,
}, testInfo) => {
  await openHome(page);
  await expect(page.locator('img[data-hero]')).toBeVisible();
  expect(await imageLoaded(page, 'img[data-hero]')).toBe(true);
  await expect(page.locator('h1')).toHaveText('Prime Trail');
  await expect(page.locator('[data-rules-body] li')).toHaveCount(3);
  for (const d of ['easy', 'advanced', 'challenge']) {
    await expect(page.locator(`[data-difficulty="${d}"] [data-difficulty-hint]`)).toBeVisible();
  }
  await noHorizontalScroll(page);

  await page.locator('[data-level-id]').fill('7');
  await page.locator('[data-difficulty="advanced"]').click();
  await expect(page.locator('[data-difficulty="advanced"]')).toHaveAttribute('aria-pressed', 'true');
  await shoot(page, 'selected', testInfo.project.name);

  await page.locator('button[data-action="start"]').click();
  await expect(page).toHaveURL(/\/play\/7\/advanced$/);
});

test('the rules card remembers being collapsed across reloads', async ({ page }) => {
  await openHome(page);
  const toggle = page.locator('button[data-action="toggleRules"]');
  const body = page.locator('[data-rules-body]');
  await expect(body).toBeVisible();
  await toggle.click();
  await expect(body).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  const stored = await page.evaluate((key) => window.localStorage.getItem(key), UI_KEY);
  expect(JSON.parse(stored!)).toMatchObject({ rulesCollapsed: true });

  await page.reload();
  await waitReady(page);
  await expect(body).toBeHidden();
  await toggle.click();
  await expect(body).toBeVisible();
});

test('a missing level library shows the illustration and explanation', async ({ page }, testInfo) => {
  await openHome(page);
  // Dev-server only: reach the same store singleton the app uses and drop its loader, which is
  // what a build without src/data/levels.json looks like (status 'missing').
  await page.evaluate(async () => {
    const path = '/src/composables/useLevelStore.ts';
    const mod = (await import(/* @vite-ignore */ path)) as {
      useLevelStore(): { __setLoader(fn: null): void; load(): Promise<void> };
    };
    const store = mod.useLevelStore();
    store.__setLoader(null);
    await store.load();
  });
  const missing = page.locator('[data-state="missing"]');
  await expect(missing).toBeVisible();
  await expect(page.locator('.pt-level-picker')).toHaveCount(0);
  await expect(missing.locator('img[data-missing-img]')).toBeVisible();
  expect(await imageLoaded(page, 'img[data-missing-img]')).toBe(true);
  await noHorizontalScroll(page);
  await shoot(page, 'missing', testInfo.project.name);
});
