/**
 * WCAG contrast check for the UI refresh design tokens (spec 2026-10-25-ui-refresh §3).
 *
 *   pnpm exec tsx scripts/check-contrast.ts
 *
 * Reads the `--pt-*` colour tokens and the Bootstrap overrides straight from src/styles/main.scss
 * so the check cannot drift from the stylesheet, then checks every foreground／background pair the
 * app paints. Text needs ≥ 4.5:1 (≥ 3:1 when marked large: ≥ 24px, or ≥ 18.66px bold); rings,
 * grid lines and markers are WCAG 1.4.11 non-text indicators and need ≥ 3:1. Exits 1 on failure.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scss = readFileSync(resolve(root, 'src/styles/main.scss'), 'utf8');

function readTokens(src: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of src.matchAll(/(--pt-[a-z-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)) {
    out.set(m[1], normalise(m[2]));
  }
  return out;
}

function readScssVar(src: string, name: string): string | undefined {
  const m = src.match(new RegExp(`\\$${name}:\\s*(#[0-9a-fA-F]{3,6})\\s*;`));
  return m ? normalise(m[1]) : undefined;
}

function normalise(hex: string): string {
  let h = hex.slice(1).toLowerCase();
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return `#${h}`;
}

function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = ch.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

type Kind = 'text' | 'large' | 'ui';
const MIN: Record<Kind, number> = { text: 4.5, large: 3, ui: 3 };
const LABEL: Record<Kind, string> = { text: 'text', large: 'large text', ui: 'non-text' };

const tokens = readTokens(scss);
tokens.set('#fff', '#ffffff');

// [foreground, background, kind, where it is used]
const pairs: Array<[string, string, Kind, string]> = [
  // Page and surfaces
  ['--pt-text', '--pt-bg', 'text', 'body text on page background'],
  ['--pt-text', '--pt-surface', 'text', 'body text on cards／dialogs'],
  ['--pt-text-muted', '--pt-bg', 'text', 'secondary text, outline-secondary buttons on page'],
  ['--pt-text-muted', '--pt-surface', 'text', 'secondary text on cards'],
  ['#fff', '--pt-text-muted', 'text', 'btn-secondary label ($secondary)'],
  ['--pt-primary', '--pt-bg', 'text', 'outline-primary buttons／links on page'],
  ['--pt-primary', '--pt-surface', 'text', 'outline-primary buttons／links on cards'],
  ['#fff', '--pt-primary', 'text', 'btn-primary label; start cell number'],
  ['#fff', '--pt-primary-strong', 'text', 'btn-primary hover label'],
  ['--pt-danger', '--pt-bg', 'text', 'outline-danger button on page'],
  ['--pt-danger', '--pt-surface', 'text', 'outline-danger button／error text on cards'],
  ['#fff', '--pt-danger', 'text', 'btn-danger label'],
  ['#fff', '--pt-pink', 'large', 'new-record badge (must be large／bold text)'],
  // Board numbers (Review Focus 3: conflict red and player blue on the yellow prime cell)
  ['--pt-text', '--pt-prime', 'text', 'given number on prime cell'],
  ['--pt-primary-strong', '--pt-surface', 'text', 'player number (is-filled) on white cell'],
  ['--pt-primary-strong', '--pt-prime', 'text', 'player number (is-filled) on prime cell'],
  ['--pt-danger', '--pt-surface', 'text', 'conflict number on white cell'],
  ['--pt-danger', '--pt-prime', 'text', 'conflict number on prime cell'],
  // Board indicators (rings, grid lines, markers)
  ['--pt-primary', '--pt-surface', 'ui', 'selected ring on white cell; head marker on band'],
  ['--pt-primary', '--pt-prime', 'ui', 'selected ring on prime cell'],
  ['--pt-primary', '--pt-bg', 'ui', 'board focus ring on page'],
  ['--pt-prime', '--pt-primary', 'ui', 'selected ring on start cell'],
  ['--pt-text', '--pt-surface', 'ui', 'trail-head ring on white cell'],
  ['--pt-text', '--pt-prime', 'ui', 'trail-head ring on prime cell'],
  ['--pt-surface', '--pt-primary', 'ui', 'trail-head／conflict ring on start cell'],
  ['--pt-hint', '--pt-surface', 'ui', 'hint highlight ring on white cell'],
  ['--pt-hint', '--pt-prime', 'ui', 'hint highlight ring on prime cell'],
  ['--pt-danger', '--pt-surface', 'ui', 'conflict ring on white cell'],
  ['--pt-danger', '--pt-prime', 'ui', 'conflict ring on prime cell'],
  ['--pt-text-muted', '--pt-surface', 'ui', 'grid line on white cell'],
  ['--pt-text-muted', '--pt-prime', 'ui', 'grid line on prime cell'],
];

// Tokens used only as decoration next to text that carries the meaning; not contrast-checked.
const decorative = ['--pt-accent', '--pt-success'];

let failed = 0;

// The Bootstrap overrides must match the tokens they mirror.
const mirrors: Array<[string, string]> = [
  ['primary', '--pt-primary'],
  ['danger', '--pt-danger'],
  ['secondary', '--pt-text-muted'],
  ['body-bg', '--pt-bg'],
  ['body-color', '--pt-text'],
];
for (const [scssVar, token] of mirrors) {
  const v = readScssVar(scss, scssVar);
  const ok = v !== undefined && v === tokens.get(token);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  $${scssVar} = ${v ?? '(missing)'} mirrors ${token} = ${tokens.get(token) ?? '(missing)'}`);
}

for (const [fg, bg, kind, where] of pairs) {
  const f = tokens.get(fg);
  const b = tokens.get(bg);
  if (!f || !b) {
    failed++;
    console.log(`FAIL  ${fg} on ${bg}: token missing from main.scss`);
    continue;
  }
  const ratio = contrast(f, b);
  const ok = ratio >= MIN[kind];
  if (!ok) failed++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${ratio.toFixed(2).padStart(5)}:1 ≥ ${MIN[kind]} (${LABEL[kind]})  ` +
      `${fg} ${f} on ${bg} ${b} — ${where}`,
  );
}

console.log(`\nDecorative only (not checked): ${decorative.join(', ')}`);
console.log(`${pairs.length + mirrors.length - failed}/${pairs.length + mirrors.length} checks passed`);
if (failed > 0) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
