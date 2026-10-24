import { expect, test } from '@playwright/test';

test('home page renders main', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
});
