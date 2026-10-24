import type { Difficulty } from '../core/types';
import type { PdfLabels } from './labels';

/** English fallback used when the CJK subset font cannot be loaded; drawn with Helvetica. */
export const PDF_LABELS_EN: Omit<PdfLabels, 'difficultyName'> & {
  difficultyNames: Record<Difficulty, string>;
} = {
  title: 'Prime Trail',
  level: 'Map #{id}',
  difficulty: 'Difficulty: {difficulty}',
  legendHead: 'Dark grey: the head (number 1)',
  legendPrime: 'Light grey: prime cells',
  solutionTitle: 'Reference solution',
  difficultyNames: { easy: 'Easy', advanced: 'Advanced', challenge: 'Challenge' },
};

export function pdfLabelsEn(difficulty: Difficulty): PdfLabels {
  const { difficultyNames, ...rest } = PDF_LABELS_EN;
  return { ...rest, difficultyName: difficultyNames[difficulty] };
}
