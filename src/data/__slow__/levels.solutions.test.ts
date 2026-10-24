import { describe, expect, it } from 'vitest';
import { decodeLevel, derivePuzzle } from '../../core/level-decode';
import { solve } from '../../core/solver';
import { isSolved } from '../../core/validate';
import { SAMPLE_IDS, readLevelFile } from '../__tests__/helpers';

// spec §12.2: 20 fixed ids, the solver's collected challenge solution must pass isSolved.
const IDS = [...SAMPLE_IDS, 10, 123, 200, 321, 404, 555, 610, 777, 808, 999];
const CHAL_BUDGET = 5_000_000; // scripts/gen-config.ts challengeBudget

describe('levels.json solver solutions', () => {
  it('uses 20 distinct ids', () => {
    expect(new Set(IDS).size).toBe(20);
  });

  it('collected challenge solutions pass isSolved', () => {
    const levels = readLevelFile().levels;
    let found = 0;
    for (const id of IDS) {
      const puzzle = derivePuzzle(decodeLevel(levels[id - 1], id), 'challenge');
      const r = solve(puzzle, { maxSolutions: 1, maxNodes: CHAL_BUDGET, collect: true });
      if (r.count === 0) continue;
      found++;
      expect(isSolved(r.solutions![0], puzzle), `level ${id}`).toBe(true);
    }
    // A challenge puzzle is solvable by construction; finding none at all means the solver broke.
    expect(found).toBeGreaterThan(0);
  });
});
