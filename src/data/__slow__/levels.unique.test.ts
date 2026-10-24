import { describe, expect, it } from 'vitest';
import { decodeLevel, derivePuzzle, hintMaskToPrimes } from '../../core/level-decode';
import { solve } from '../../core/solver';
import type { Difficulty } from '../../core/types';
import { readLevelFile, skipWithoutLevels } from '../__tests__/helpers';

// Same budgets and floor as scripts/gen-config.ts (EASY_BUDGET, ADV_BUDGET, ADV_FLOOR; spec §4.3-§4.5).
const BUDGET: Record<Exclude<Difficulty, 'challenge'>, number> = {
  easy: 200_000,
  advanced: 2_000_000,
};
const ADV_FLOOR = 6;

describe.skipIf(skipWithoutLevels())('levels.json uniqueness (all 1000)', () => {
  const levels = () => readLevelFile().levels.map((record, i) => decodeLevel(record, i + 1));

  for (const difficulty of ['easy', 'advanced'] as const) {
    it(`${difficulty} has exactly one solution within budget`, () => {
      const failures: string[] = [];
      for (const level of levels()) {
        const r = solve(derivePuzzle(level, difficulty), {
          maxSolutions: 2,
          maxNodes: BUDGET[difficulty],
        });
        if (r.count !== 1 || !r.exhausted) {
          failures.push(`#${level.id}: count=${r.count} exhausted=${r.exhausted}`);
        }
      }
      expect(failures).toEqual([]);
    });
  }

  it(`advanced shows at least ${ADV_FLOOR} primes`, () => {
    const failures = readLevelFile()
      .levels.map((record, i) => ({ id: i + 1, size: hintMaskToPrimes(record.h).size }))
      .filter(({ size }) => size < ADV_FLOOR)
      .map(({ id, size }) => `#${id}: ${size}`);
    expect(failures).toEqual([]);
  });
});
