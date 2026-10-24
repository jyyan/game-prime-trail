/// <reference types="node" />
import { existsSync, readFileSync, statSync } from 'node:fs';
import * as fontkit from 'fontkit';
import { describe, expect, it } from 'vitest';
import { FIXTURE_RECORD } from '../../core/__fixtures__/level-fixture';
import { decodeLevel } from '../../core/level-decode';
import { zhTW } from '../../i18n/zh-TW';
import { PDF_FONT_FAMILY } from '../font-loader';
import { pdfFontCharset, pdfLabelsFromI18n } from '../labels';
import { renderPuzzlePdf } from '../renderPuzzlePdf';

const FONT_PATH = 'public/fonts/pdf-zh.subset.ttf';
const hasFont = existsSync(FONT_PATH);
if (!hasFont) console.warn(`${FONT_PATH} missing (run pnpm gen:pdf-font); skipping font coverage`);

function leafText(node: unknown): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'object' && node !== null) return Object.values(node).map(leafText).join('');
  return '';
}

describe.skipIf(!hasFont)('pdf subset font', () => {
  it('has a glyph for every character the PDF can draw', () => {
    const font = fontkit.openSync(FONT_PATH) as fontkit.Font;
    const required = leafText(zhTW.pdf) + leafText(zhTW.difficulty) + 'Prime Trail 0123456789#:・' + pdfFontCharset();
    const missing = [...new Set(Array.from(required))].filter(
      (ch) => !font.hasGlyphForCodePoint(ch.codePointAt(0) as number),
    );
    expect(missing).toEqual([]);
  });

  it('stays small', () => {
    expect(statSync(FONT_PATH).size).toBeLessThan(100 * 1024);
  });

  it('is a TrueType font jsPDF can embed', async () => {
    const bytes = readFileSync(FONT_PATH);
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const blob = await renderPuzzlePdf({
      level: decodeLevel(FIXTURE_RECORD, 123),
      difficulty: 'advanced',
      includeSolution: true,
      labels: pdfLabelsFromI18n('advanced'),
      font: { family: PDF_FONT_FAMILY, data },
    });
    const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    expect(String.fromCharCode(...head)).toBe('%PDF-');
    expect(blob.size).toBeGreaterThan(bytes.byteLength / 2);
  });
});
