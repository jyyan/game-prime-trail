// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { FIXTURE_RECORD } from '../../src/core/__fixtures__/level-fixture';
import { isEdge } from '../../src/core/geometry';
import { decodeLevel, derivePuzzle, hintMaskToPrimes } from '../../src/core/level-decode';
import { createRng, levelSeed } from '../../src/core/rng';
import { solve } from '../../src/core/solver';
import { GEN_CONFIG, type GenConfig } from '../gen-config';
import { generateLevel, greedyHintMask, popcount, recomputeRow, type MetaRow } from '../lib/gen-level';

const SMALL: GenConfig = {
  ...GEN_CONFIG,
  backbiteSteps: 2000,
  candidates: 1,
  challengeBudget: 50_000,
  advBudget: 200_000,
  advRestarts: 1,
};

const withoutMs = (row: MetaRow): MetaRow => ({ ...row, ms: 0 });

function isUnique(row: Pick<MetaRow, 's' | 'p' | 'h'>, difficulty: 'easy' | 'advanced'): boolean {
  const level = decodeLevel({ ...row, c: null, seed: 0 }, 1);
  const r = solve(derivePuzzle(level, difficulty), { maxSolutions: 2, maxNodes: 2_000_000 });
  return r.count === 1 && r.exhausted;
}

describe('generateLevel', () => {
  const row = generateLevel(1, SMALL);

  it('produces a valid, uniquely solvable level record', () => {
    expect(row.id).toBe(1);
    expect(row.p).toMatch(/^[UDLR]{99}$/);
    expect(isEdge(row.s)).toBe(true);
    expect(isUnique(row, 'easy')).toBe(true);
    expect(isUnique(row, 'advanced')).toBe(true);
    expect(row.hintCount).toBe(popcount(row.h));
    expect(row.hintCount).toBeGreaterThanOrEqual(6);
    expect(row.seed).toBe(levelSeed('prime-trail-v1', 1, row.attempt));
    expect(row.c === null || (row.c >= 1 && row.c <= SMALL.challengeCap)).toBe(true);
    expect(row.candidates).toEqual([
      { attempt: row.attempt, seed: row.seed, c: row.c, nodes: row.nodes.chal },
    ]);
    expect(row.generator).toBe(GEN_CONFIG.generator);
  });

  it('is reproducible', () => {
    expect(withoutMs(generateLevel(1, SMALL))).toEqual(withoutMs(row));
  });

  it('picks the candidate with the fewest challenge solutions, earliest on ties', () => {
    const multi = generateLevel(2, { ...SMALL, candidates: 3 });
    expect(multi.candidates).toHaveLength(3);
    const attempts = multi.candidates.map((cand) => cand.attempt);
    expect(attempts).toEqual([...attempts].sort((a, b) => a - b));
    const rank = (c: number | null): number => c ?? Number.POSITIVE_INFINITY;
    const best = Math.min(...multi.candidates.map((cand) => rank(cand.c)));
    const first = multi.candidates.find((cand) => rank(cand.c) === best);
    expect(multi.attempt).toBe(first?.attempt);
    expect(multi.c).toBe(first?.c);
  });

  it('gives up after maxAttemptsPerLevel', () => {
    expect(() => generateLevel(1, { ...SMALL, maxAttemptsPerLevel: 0 })).toThrow(/after 0 attempts/);
  });

  it('recomputes h and c from the seed to the same values', () => {
    const again = recomputeRow(row, ['h', 'c'], SMALL);
    expect({ ...again, ms: 0 }).toEqual(withoutMs(row));
  });
});

describe('greedyHintMask', () => {
  it('stops at the floor and stays unique', () => {
    const level = decodeLevel(FIXTURE_RECORD, 1);
    const mask = greedyHintMask(level, createRng(1), { advFloor: 6, advBudget: 2_000_000 });
    expect(popcount(mask)).toBe(6);
    const hinted = { ...level, advancedHints: hintMaskToPrimes(mask) };
    const r = solve(derivePuzzle(hinted, 'advanced'), { maxSolutions: 2, maxNodes: 2_000_000 });
    expect(r).toMatchObject({ count: 1, exhausted: true });
  });

  it('keeps the smallest subset over restarts', () => {
    const level = decodeLevel(FIXTURE_RECORD, 1);
    // A small budget keeps this fast: puzzles not settled within it count as not unique.
    const cfg = { advFloor: 1, advBudget: 20_000 };
    // The first of three restarts sees the same rng state as a single-restart run.
    const once = greedyHintMask(level, createRng(7), { ...cfg, advRestarts: 1 });
    const mask = greedyHintMask(level, createRng(7), { ...cfg, advRestarts: 3 });
    expect(popcount(mask)).toBeLessThanOrEqual(popcount(once));
    const hinted = { ...level, advancedHints: hintMaskToPrimes(mask) };
    const r = solve(derivePuzzle(hinted, 'advanced'), { maxSolutions: 2, maxNodes: 2_000_000 });
    expect(r).toMatchObject({ count: 1, exhausted: true });
  });
});
