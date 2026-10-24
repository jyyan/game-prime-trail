import { expect, test } from '@playwright/test';
import { board, openPlay } from './helpers';

// GAME-27 (UI refresh spec §3, §4, §5.1): three play-page layout regressions.
// Level 257 on advanced puts the trail head on the bottom row, so the board's bottom edge matters.
const LEVEL = 257;

test.describe('play page layout polish', () => {
  test.beforeEach(async ({ page }) => {
    await openPlay(page, LEVEL, 'advanced');
  });

  test('board clay shadow is not clipped by an overflow ancestor', async ({ page }) => {
    const clip = await board(page).evaluate((el) => {
      const rect = el.getBoundingClientRect();
      let node = el.parentElement;
      while (node && node !== document.documentElement) {
        const s = getComputedStyle(node);
        if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
          const r = node.getBoundingClientRect();
          return {
            board: { left: rect.left, right: rect.right, bottom: rect.bottom },
            clipper: { left: r.left, right: r.right, top: r.top, bottom: r.bottom },
            className: node.className,
          };
        }
        node = node.parentElement;
      }
      return null;
    });
    // Every ancestor up to <html> has overflow visible: nothing can clip the shadow.
    if (clip === null) return;
    // The clay shadow reaches ~16px below (6px offset + 10px offset of a 24px blur) and ~24px wide.
    expect(clip.board.bottom + 30, `clipped by .${clip.className}`).toBeLessThanOrEqual(clip.clipper.bottom);
    expect(clip.board.left - 24, `clipped by .${clip.className}`).toBeGreaterThanOrEqual(clip.clipper.left);
    expect(clip.board.right + 24, `clipped by .${clip.className}`).toBeLessThanOrEqual(clip.clipper.right);
  });

  test('assisted badge text meets WCAG contrast', async ({ page }) => {
    await page.locator('[data-view="play"] [data-action="hint"]').click();
    const badge = page.locator('[data-assisted]');
    await expect(badge).toBeVisible();

    const m = await badge.evaluate((el) => {
      const parse = (c: string): [number, number, number, number] => {
        const n = c.match(/[\d.]+/g)!.map(Number);
        return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1];
      };
      // Effective background: composite translucent layers up to the first opaque one.
      const layers: Array<[number, number, number, number]> = [];
      let node: Element | null = el;
      while (node) {
        const bg = parse(getComputedStyle(node).backgroundColor);
        if (bg[3] > 0) layers.push(bg);
        if (bg[3] >= 1) break;
        node = node.parentElement;
      }
      let rgb: [number, number, number] = [255, 255, 255];
      for (const [r, g, b, a] of layers.reverse()) {
        rgb = [r * a + rgb[0] * (1 - a), g * a + rgb[1] * (1 - a), b * a + rgb[2] * (1 - a)];
      }
      const s = getComputedStyle(el);
      const fg = parse(s.color);
      const lum = ([r, g, b]: number[]) => {
        const lin = [r, g, b].map((v) => {
          const x = v / 255;
          return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
      };
      const [hi, lo] = [lum(fg), lum(rgb)].sort((a, b) => b - a);
      return {
        ratio: (hi + 0.05) / (lo + 0.05),
        color: s.color,
        background: `rgb(${rgb.map(Math.round).join(', ')})`,
      };
    });
    expect(m.ratio, `${m.color} on ${m.background}`).toBeGreaterThanOrEqual(4.5);
  });

  test('input mode toggle buttons split the row evenly', async ({ page }) => {
    const group = page.locator('[data-view="play"] [role="group"]', { has: page.locator('button[data-mode]') });
    const parent = await group.evaluate((el) => el.parentElement!.getBoundingClientRect().width);
    const trail = await page.locator('button[data-mode="trail"]').boundingBox();
    const direct = await page.locator('button[data-mode="direct"]').boundingBox();
    expect(trail).not.toBeNull();
    expect(direct).not.toBeNull();
    expect(Math.abs(trail!.width - direct!.width)).toBeLessThanOrEqual(2);
    expect(trail!.width + direct!.width).toBeGreaterThanOrEqual(parent - 2);
  });
});
