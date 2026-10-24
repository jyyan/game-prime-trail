import type { Difficulty } from '../core/types';
import { t } from '../i18n';
import { zhTW } from '../i18n/zh-TW';

/**
 * Text drawn on the PDF. `level` keeps its `{id}` placeholder and `difficulty` its `{difficulty}`
 * placeholder; the renderer fills them in (the id zero-padded, the difficulty with `difficultyName`).
 */
export interface PdfLabels {
  title: string;
  level: string;
  difficulty: string;
  difficultyName: string;
  legendHead: string;
  legendPrime: string;
  solutionTitle: string;
}

/** Labels from the zh-TW string table; only drawable with the PDF subset font loaded. */
export function pdfLabelsFromI18n(difficulty: Difficulty): PdfLabels {
  return {
    title: t('pdf.docTitle'),
    level: t('pdf.level'),
    difficulty: t('pdf.difficulty'),
    difficultyName: t(`difficulty.${difficulty}`),
    legendHead: t('pdf.legendHead'),
    legendPrime: t('pdf.legendPrime'),
    solutionTitle: t('pdf.solutionTitle'),
  };
}

/** Characters outside the string tables that the PDF may draw with the subset font. */
export const PDF_FONT_EXTRA_CHARS = '0123456789#:・.- Prime Trail';

function collectLeaves(node: unknown, out: string[]): string[] {
  if (typeof node === 'string') out.push(node);
  else if (typeof node === 'object' && node !== null) {
    for (const value of Object.values(node)) collectLeaves(value, out);
  }
  return out;
}

/**
 * Every character the subset font must cover: all leaves of the `pdf` and `difficulty` namespaces
 * plus {@link PDF_FONT_EXTRA_CHARS}, as unique code points in ascending order. Shared by
 * `scripts/gen-pdf-font.ts` and the font coverage test so the two cannot drift apart.
 */
export function pdfFontCharset(): string {
  const text = [
    ...collectLeaves(zhTW.pdf, []),
    ...collectLeaves(zhTW.difficulty, []),
    PDF_FONT_EXTRA_CHARS,
  ].join('');
  const codePoints = [...new Set(Array.from(text, (ch) => ch.codePointAt(0) as number))];
  return String.fromCodePoint(...codePoints.sort((a, b) => a - b));
}
