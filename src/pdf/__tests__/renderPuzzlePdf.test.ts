import { jsPDF } from 'jspdf';
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_RECORD } from '../../core/__fixtures__/level-fixture';
import { decodeLevel } from '../../core/level-decode';
import type { Difficulty, Level } from '../../core/types';
import { pdfLabelsEn } from '../labels-en';
import {
  HEAD_GREY,
  PRIME_GREY,
  pdfFilename,
  renderPuzzlePdf,
  renderPuzzlePdfDoc,
  type RenderPuzzleInput,
} from '../renderPuzzlePdf';

const level = decodeLevel(FIXTURE_RECORD, 123);

/** Boustrophedon path starting at the corner cell 0. */
function cornerLevel(): Level {
  let dirs = '';
  for (let r = 0; r < 10; r++) {
    dirs += (r % 2 === 0 ? 'R' : 'L').repeat(9);
    if (r < 9) dirs += 'D';
  }
  return decodeLevel({ s: 0, p: dirs, h: 0, c: null, seed: 0 }, 7);
}

function input(overrides: Partial<RenderPuzzleInput> = {}): RenderPuzzleInput {
  const difficulty: Difficulty = overrides.difficulty ?? 'easy';
  return {
    level,
    difficulty,
    includeSolution: false,
    labels: pdfLabelsEn(difficulty),
    font: null,
    ...overrides,
  };
}

function newDoc(): jsPDF {
  return new jsPDF({ unit: 'mm', format: 'a4' });
}

function textArgs(spy: { mock: { calls: unknown[][] } }): unknown[] {
  return spy.mock.calls.map((call) => call[0]);
}

describe('renderPuzzlePdfDoc', () => {
  it('produces one page without the solution and two with it', () => {
    expect(renderPuzzlePdfDoc(input()).getNumberOfPages()).toBe(1);
    expect(renderPuzzlePdfDoc(input({ includeSolution: true })).getNumberOfPages()).toBe(2);
  });

  it('draws only the givens of the difficulty on the puzzle page', () => {
    const easyDoc = newDoc();
    const easySpy = vi.spyOn(easyDoc, 'text');
    renderPuzzlePdfDoc(input({ difficulty: 'easy' }), easyDoc);
    const easyTexts = textArgs(easySpy);
    expect(easyTexts.filter((s) => s === '97')).toHaveLength(1);
    expect(easyTexts).toContain('1');
    expect(easyTexts).not.toContain('4');

    const chalDoc = newDoc();
    const chalSpy = vi.spyOn(chalDoc, 'text');
    renderPuzzlePdfDoc(input({ difficulty: 'challenge' }), chalDoc);
    const chalTexts = textArgs(chalSpy);
    expect(chalTexts).not.toContain('97');
    expect(chalTexts).toContain('1');
  });

  it('draws the advanced hint subset only', () => {
    const doc = newDoc();
    const spy = vi.spyOn(doc, 'text');
    renderPuzzlePdfDoc(input({ difficulty: 'advanced' }), doc);
    const texts = textArgs(spy);
    for (const p of [17, 19, 23, 29, 31, 37]) expect(texts).toContain(String(p));
    expect(texts).not.toContain('97');
    expect(texts).not.toContain('2');
  });

  it('fills the labels in: zero-padded id and difficulty name', () => {
    const doc = newDoc();
    const spy = vi.spyOn(doc, 'text');
    renderPuzzlePdfDoc(input({ difficulty: 'advanced' }), doc);
    const texts = textArgs(spy);
    expect(texts).toContain('Prime Trail');
    expect(texts).toContain('Map #0123');
    expect(texts).toContain('Difficulty: Advanced');
  });

  it('draws every number 1-100 on the solution page', () => {
    const doc = newDoc();
    const spy = vi.spyOn(doc, 'text');
    renderPuzzlePdfDoc(input({ difficulty: 'challenge', includeSolution: true }), doc);
    const texts = textArgs(spy);
    for (let k = 2; k <= 100; k++) expect(texts).toContain(String(k));
    expect(texts).toContain('Reference solution');
  });

  it('draws one head triangle per board edge the start cell touches', () => {
    const edgeDoc = newDoc();
    const edgeSpy = vi.spyOn(edgeDoc, 'triangle');
    renderPuzzlePdfDoc(input(), edgeDoc); // start = 8, top edge only
    expect(edgeSpy).toHaveBeenCalledTimes(1);

    const cornerDoc = newDoc();
    const cornerSpy = vi.spyOn(cornerDoc, 'triangle');
    renderPuzzlePdfDoc(input({ level: cornerLevel() }), cornerDoc); // start = 0, top + left
    expect(cornerSpy).toHaveBeenCalledTimes(2);
  });

  it('fills the head with 55% grey and prime cells with 85% grey', () => {
    expect(HEAD_GREY).toBe(Math.round(255 * 0.55));
    expect(PRIME_GREY).toBe(Math.round(255 * 0.85));
    const doc = newDoc();
    const spy = vi.spyOn(doc, 'setFillColor');
    renderPuzzlePdfDoc(input(), doc);
    const calls = spy.mock.calls.map((c) => c.slice(0, 3).join(','));
    expect(calls).toContain(`${HEAD_GREY},${HEAD_GREY},${HEAD_GREY}`);
    expect(calls).toContain(`${PRIME_GREY},${PRIME_GREY},${PRIME_GREY}`);
  });

  it('uses Helvetica for all text when no font is given', () => {
    const doc = newDoc();
    const spy = vi.spyOn(doc, 'setFont');
    renderPuzzlePdfDoc(input({ includeSolution: true }), doc);
    expect(spy.mock.calls.length).toBeGreaterThan(0);
    for (const call of spy.mock.calls) expect(call[0]).toBe('helvetica');
  });
});

describe('renderPuzzlePdf', () => {
  it('returns a PDF blob', async () => {
    const blob = await renderPuzzlePdf(input({ includeSolution: true }));
    expect(blob.size).toBeGreaterThan(1000);
    const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    expect(String.fromCharCode(...head)).toBe('%PDF-');
  });
});

describe('pdfFilename', () => {
  it('zero-pads the id to four digits', () => {
    expect(pdfFilename(123, 'advanced')).toBe('prime-trail-0123-advanced.pdf');
    expect(pdfFilename(1000, 'easy')).toBe('prime-trail-1000-easy.pdf');
    expect(pdfFilename(7, 'challenge')).toBe('prime-trail-0007-challenge.pdf');
  });
});
