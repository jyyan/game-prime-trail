import { jsPDF } from 'jspdf';
import { colOf, edgeSides, rowOf, type EdgeSide } from '../core/geometry';
import { derivePuzzle } from '../core/level-decode';
import { BOARD_SIZE, CELL_COUNT, type Cell, type Difficulty, type Level } from '../core/types';
import type { PdfLabels } from './labels';

export interface PdfFont {
  family: string;
  data: ArrayBuffer;
}

export interface RenderPuzzleInput {
  level: Level;
  difficulty: Difficulty;
  includeSolution: boolean;
  labels: PdfLabels;
  /** CJK font for the labels; `null` draws every label with Helvetica. */
  font: PdfFont | null;
}

// Geometry (spec §6.9): A4 portrait in mm, a 160 mm board centred horizontally.
const PAGE_WIDTH = 210;
const BOARD_MM = 160;
const CELL_MM = BOARD_MM / BOARD_SIZE;
const BOARD_X = (PAGE_WIDTH - BOARD_MM) / 2;
const BOARD_Y = 50;
const GRID_LINE_MM = 0.3;
const PATH_LINE_MM = 0.6;
/** Head-marker triangle in the frame band outside the board: half base width, gap, height. */
const TRIANGLE_HALF_BASE = 3;
const TRIANGLE_GAP = 1.5;
const TRIANGLE_HEIGHT = 4.5;

/** Grey levels as RGB channel values: 55% grey for the head, 85% grey for prime cells. */
export const HEAD_GREY = Math.round(255 * 0.55);
export const PRIME_GREY = Math.round(255 * 0.85);
const MARKER_GREY = 64;
const PATH_RGB: readonly [number, number, number] = [52, 101, 164];

const NUMBER_FONT = 'helvetica';
const FONT_VFS_NAME = 'pdf-zh.subset.ttf';

export function pdfFilename(levelId: number, difficulty: Difficulty): string {
  return `prime-trail-${String(levelId).padStart(4, '0')}-${difficulty}.pdf`;
}

function arrayBufferToBase64(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Registers the CJK font and returns the family to draw labels with. */
function registerLabelFont(doc: jsPDF, font: PdfFont | null): string {
  if (font === null) return NUMBER_FONT;
  doc.addFileToVFS(FONT_VFS_NAME, arrayBufferToBase64(font.data));
  doc.addFont(FONT_VFS_NAME, font.family, 'normal');
  // jsPDF parses the TTF lazily; measure once so a broken font throws here, not mid-page.
  doc.setFont(font.family, 'normal');
  doc.getTextWidth('Prime Trail');
  return font.family;
}

function cellX(cell: Cell): number {
  return BOARD_X + colOf(cell) * CELL_MM;
}

function cellY(cell: Cell): number {
  return BOARD_Y + rowOf(cell) * CELL_MM;
}

function drawHeader(doc: jsPDF, labelFont: string, heading: string, input: RenderPuzzleInput): void {
  const { labels, level } = input;
  doc.setTextColor(0, 0, 0);
  doc.setFont(labelFont, 'normal');
  doc.setFontSize(20);
  doc.text(heading, PAGE_WIDTH / 2, 24, { align: 'center', baseline: 'middle' });
  doc.setFontSize(12);
  const levelText = labels.level.replace('{id}', String(level.id).padStart(4, '0'));
  const difficultyText = labels.difficulty.replace('{difficulty}', labels.difficultyName);
  doc.text(levelText, BOARD_X, 38, { baseline: 'middle' });
  doc.text(difficultyText, BOARD_X + BOARD_MM, 38, { align: 'right', baseline: 'middle' });
}

function drawCellFills(doc: jsPDF, level: Level): void {
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    let grey: number | null = null;
    if (cell === level.start) grey = HEAD_GREY;
    else if (level.grey[cell]) grey = PRIME_GREY;
    if (grey === null) continue;
    doc.setFillColor(grey, grey, grey);
    doc.rect(cellX(cell), cellY(cell), CELL_MM, CELL_MM, 'F');
  }
}

function drawGrid(doc: jsPDF): void {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(GRID_LINE_MM);
  for (let i = 0; i <= BOARD_SIZE; i++) {
    const offset = i * CELL_MM;
    doc.line(BOARD_X, BOARD_Y + offset, BOARD_X + BOARD_MM, BOARD_Y + offset);
    doc.line(BOARD_X + offset, BOARD_Y, BOARD_X + offset, BOARD_Y + BOARD_MM);
  }
}

/** One filled triangle per board edge the start cell touches, pointing at the start cell (§6.3). */
function drawHeadMarkers(doc: jsPDF, start: Cell): void {
  doc.setFillColor(MARKER_GREY, MARKER_GREY, MARKER_GREY);
  const cx = cellX(start) + CELL_MM / 2;
  const cy = cellY(start) + CELL_MM / 2;
  const top = BOARD_Y;
  const bottom = BOARD_Y + BOARD_MM;
  const left = BOARD_X;
  const right = BOARD_X + BOARD_MM;
  const base = TRIANGLE_GAP + TRIANGLE_HEIGHT;
  const draw: Record<EdgeSide, () => void> = {
    top: () =>
      doc.triangle(cx - TRIANGLE_HALF_BASE, top - base, cx + TRIANGLE_HALF_BASE, top - base, cx, top - TRIANGLE_GAP, 'F'),
    bottom: () =>
      doc.triangle(
        cx - TRIANGLE_HALF_BASE,
        bottom + base,
        cx + TRIANGLE_HALF_BASE,
        bottom + base,
        cx,
        bottom + TRIANGLE_GAP,
        'F',
      ),
    left: () =>
      doc.triangle(left - base, cy - TRIANGLE_HALF_BASE, left - base, cy + TRIANGLE_HALF_BASE, left - TRIANGLE_GAP, cy, 'F'),
    right: () =>
      doc.triangle(
        right + base,
        cy - TRIANGLE_HALF_BASE,
        right + base,
        cy + TRIANGLE_HALF_BASE,
        right + TRIANGLE_GAP,
        cy,
        'F',
      ),
  };
  for (const side of edgeSides(start)) draw[side]();
}

function drawBoardFrame(doc: jsPDF, level: Level): void {
  drawCellFills(doc, level);
  drawGrid(doc);
  drawHeadMarkers(doc, level.start);
}

function drawLegend(doc: jsPDF, labelFont: string, labels: PdfLabels): void {
  const y = BOARD_Y + BOARD_MM + 14;
  const swatch = 6;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(GRID_LINE_MM);
  doc.setFont(labelFont, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  const entries: Array<[number, number, string]> = [
    [BOARD_X, HEAD_GREY, labels.legendHead],
    [BOARD_X + BOARD_MM / 2, PRIME_GREY, labels.legendPrime],
  ];
  for (const [x, grey, text] of entries) {
    doc.setFillColor(grey, grey, grey);
    doc.rect(x, y, swatch, swatch, 'FD');
    doc.text(text, x + swatch + 2, y + swatch / 2, { baseline: 'middle' });
  }
}

function drawPuzzlePage(doc: jsPDF, labelFont: string, input: RenderPuzzleInput): void {
  const { level, difficulty, labels } = input;
  drawHeader(doc, labelFont, labels.title, input);
  drawBoardFrame(doc, level);
  const { givens } = derivePuzzle(level, difficulty);
  doc.setFont(NUMBER_FONT, 'normal');
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  for (const [cell, n] of givens) {
    doc.text(String(n), cellX(cell) + CELL_MM / 2, cellY(cell) + CELL_MM / 2, {
      align: 'center',
      baseline: 'middle',
    });
  }
  drawLegend(doc, labelFont, labels);
}

function drawSolutionPage(doc: jsPDF, labelFont: string, input: RenderPuzzleInput): void {
  const { level, labels } = input;
  drawHeader(doc, labelFont, labels.solutionTitle, input);
  drawBoardFrame(doc, level);
  // Path polyline through cell centres; numbers sit in the upper-left corner so the line stays visible.
  doc.setDrawColor(...PATH_RGB);
  doc.setLineWidth(PATH_LINE_MM);
  for (let k = 1; k < CELL_COUNT; k++) {
    const a = level.path[k - 1];
    const b = level.path[k];
    doc.line(
      cellX(a) + CELL_MM / 2,
      cellY(a) + CELL_MM / 2,
      cellX(b) + CELL_MM / 2,
      cellY(b) + CELL_MM / 2,
    );
  }
  doc.setFont(NUMBER_FONT, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  for (let k = 1; k <= CELL_COUNT; k++) {
    const cell = level.path[k - 1];
    doc.text(String(k), cellX(cell) + 1.2, cellY(cell) + 1.2, { baseline: 'top' });
  }
}

/** Draws the puzzle (and optionally the solution page) onto `doc`; exported for tests. */
export function renderPuzzlePdfDoc(
  input: RenderPuzzleInput,
  doc: jsPDF = new jsPDF({ unit: 'mm', format: 'a4' }),
): jsPDF {
  const labelFont = registerLabelFont(doc, input.font);
  drawPuzzlePage(doc, labelFont, input);
  if (input.includeSolution) {
    doc.addPage();
    drawSolutionPage(doc, labelFont, input);
  }
  return doc;
}

export async function renderPuzzlePdf(input: RenderPuzzleInput): Promise<Blob> {
  return renderPuzzlePdfDoc(input).output('blob');
}
