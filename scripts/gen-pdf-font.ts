/**
 * Builds `public/fonts/pdf-zh.subset.ttf` (spec §6.9): a Noto Sans TC subset that covers every
 * character of the `pdf` and `difficulty` string tables plus a few digits and punctuation.
 * Usage: pnpm gen:pdf-font
 *
 * The source font is cached in `.cache/fonts/` (git-ignored) and downloaded once when missing.
 * Google Fonts ships Noto Sans TC as a variable TrueType font; the weight axis is pinned to 400
 * (Regular) so the subset is a static TTF with `glyf` outlines that jsPDF can embed.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pdfFontCharset } from '../src/pdf/labels';

type SubsetFont = (
  font: Buffer,
  text: string,
  options?: {
    targetFormat?: 'sfnt' | 'woff' | 'woff2';
    variationAxes?: Record<string, number>;
    preserveNameIds?: number[];
  },
) => Promise<Buffer>;

// subset-font ships no type declarations, so load it through require with a local signature.
const subsetFont = createRequire(import.meta.url)('subset-font') as SubsetFont;

export const SOURCE_URL =
  'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanstc/NotoSansTC%5Bwght%5D.ttf';

const repoFile = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));
const SOURCE_PATH = repoFile('.cache/fonts/NotoSansTC-wght.ttf');
const OUT_PATH = repoFile('public/fonts/pdf-zh.subset.ttf');

async function ensureSource(): Promise<Buffer> {
  if (existsSync(SOURCE_PATH)) return readFileSync(SOURCE_PATH);
  console.log(`downloading ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status} ${res.statusText}`);
  const data = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(SOURCE_PATH), { recursive: true });
  writeFileSync(SOURCE_PATH, data);
  return data;
}

async function main(): Promise<void> {
  const source = await ensureSource();
  const charset = pdfFontCharset();
  const subset = await subsetFont(source, charset, {
    targetFormat: 'sfnt',
    variationAxes: { wght: 400 },
    // Keep family / subfamily / unique id / full name / version / PostScript name for jsPDF.
    preserveNameIds: [0, 1, 2, 3, 4, 5, 6],
  });
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, subset);
  const chars = Array.from(charset).length;
  const kb = (statSync(OUT_PATH).size / 1024).toFixed(1);
  console.log(`wrote ${OUT_PATH}: ${chars} characters, ${kb} KB`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
