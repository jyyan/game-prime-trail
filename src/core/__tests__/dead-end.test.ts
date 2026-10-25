import { describe, expect, it } from 'vitest';
import { readLevelFile, skipWithoutLevels } from '../../data/__tests__/helpers';
import {
  FIXTURE_PATH,
  FIXTURE_START,
  fixtureGrid,
  fixturePuzzle,
} from '../__fixtures__/level-fixture';
import { findDeadEnd, trailOf } from '../dead-end';
import { decodeLevel, derivePuzzle } from '../level-decode';
import { PRIMES } from '../primes';
import type { Cell, Puzzle } from '../types';

const EASY = fixturePuzzle(PRIMES);
const LOOSE = fixturePuzzle([]); // only the start is given

function prefix(k: number): Cell[] {
  return FIXTURE_PATH.slice(0, k);
}

/** No grey cells and only the start given: findDeadEnd then depends on geometry alone. */
function plain(start: Cell): Puzzle {
  return { start, grey: new Uint8Array(100), givens: new Map([[start, 1]]) };
}

describe('trailOf', () => {
  it('returns the first k cells of the reference solution in order', () => {
    for (const k of [1, 2, 10, 57, 100]) {
      expect(trailOf(fixtureGrid(prefix(k)), EASY)).toEqual(prefix(k));
    }
  });

  it('stops at the gap when a number is missing in the middle', () => {
    const grid = fixtureGrid(prefix(20));
    grid[FIXTURE_PATH[9]] = 0; // erase 10
    expect(trailOf(grid, EASY)).toEqual(prefix(9));
  });

  it('is [start] for a board holding only the start given', () => {
    const grid = new Uint8Array(100);
    grid[FIXTURE_START] = 1;
    expect(trailOf(grid, EASY)).toEqual([FIXTURE_START]);
  });

  it('is null when nothing is filled', () => {
    expect(trailOf(new Uint8Array(100), EASY)).toBeNull();
  });

  it('is null when 1 -> 2 is not adjacent', () => {
    const grid = new Uint8Array(100);
    grid[FIXTURE_START] = 1;
    grid[FIXTURE_PATH[2]] = 2;
    expect(trailOf(grid, EASY)).toBeNull();
  });

  it('is null on a prime/grey mismatch', () => {
    // 2 sits on a grey cell in the reference; moving 2 to the other neighbour of 1 breaks it
    const grid = new Uint8Array(100);
    grid[FIXTURE_START] = 1;
    grid[18] = 2; // adjacent to 8, not grey
    expect(trailOf(grid, LOOSE)).toBeNull();
  });

  it('is null when a given number sits on the wrong cell', () => {
    const puzzle: Puzzle = {
      ...LOOSE,
      givens: new Map([...LOOSE.givens, [FIXTURE_PATH[2], 4]]),
    };
    expect(trailOf(fixtureGrid(prefix(3)), LOOSE)).toEqual(prefix(3));
    expect(trailOf(fixtureGrid(prefix(3)), puzzle)).toBeNull();
  });

  it('is null on a duplicated trail number', () => {
    const grid = fixtureGrid(prefix(5));
    grid[0] = 3;
    expect(trailOf(grid, LOOSE)).toBeNull();
  });

  it('ignores a number placed far away (direct mode)', () => {
    const grid = fixtureGrid(prefix(10));
    grid[FIXTURE_PATH[49]] = 50;
    const trail = trailOf(grid, EASY);
    expect(trail).toEqual(prefix(10));
    expect(findDeadEnd(EASY, trail!)).toBeNull();
  });
});

describe('findDeadEnd far', () => {
  it('flags the next given when it is out of reach', () => {
    expect(findDeadEnd(EASY, [...prefix(3), 18])).toEqual({
      kind: 'far',
      cells: [39],
      rejected: [],
      target: 5,
      dist: 3,
      steps: 1,
    });
  });

  it('is null when the next given is exactly reachable', () => {
    expect(findDeadEnd(EASY, prefix(4))).toBeNull();
  });
});

describe('findDeadEnd trap', () => {
  it('lists a cell walled in on all sides', () => {
    // corner 0 has both neighbours (1, 10) visited and the head (2) is not next to it
    expect(findDeadEnd(plain(10), [10, 20, 21, 11, 1, 2])).toEqual({
      kind: 'trap',
      cells: [0],
      rejected: [],
    });
  });

  it('does not flag it while the head is still next to the cell', () => {
    expect(findDeadEnd(plain(10), [10, 20, 21, 11, 1])).toBeNull();
  });
});

describe('findDeadEnd twoEnds', () => {
  it('lists the two dead-end cells', () => {
    expect(findDeadEnd(LOOSE, [...prefix(76), 17])).toEqual({
      kind: 'twoEnds',
      cells: [26, 56],
      rejected: [],
    });
  });

  it('is null on the reference prefix', () => {
    expect(findDeadEnd(LOOSE, prefix(76))).toBeNull();
  });
});

describe('findDeadEnd split', () => {
  it('lists the block the head can no longer reach', () => {
    // the trail walls off the top-left 2x2 block {0,1,10,11}; the head has moved on to 30
    expect(findDeadEnd(plain(2), [2, 12, 22, 21, 20, 30])).toEqual({
      kind: 'split',
      cells: [0, 1, 10, 11],
      rejected: [],
    });
  });

  it('is null while the head still touches the block', () => {
    expect(findDeadEnd(plain(2), [2, 12, 22, 21, 20])).toBeNull();
  });
});

describe('findDeadEnd noMove', () => {
  it('rejects every neighbour of the head', () => {
    const d = findDeadEnd(LOOSE, [...prefix(51), 14]);
    expect(d?.kind).toBe('noMove');
    expect(d?.cells).toEqual([]);
    expect([...(d?.rejected ?? [])].sort((a, b) => a - b)).toEqual([4, 13, 15, 24]);
  });

  it('is null on the reference prefix', () => {
    expect(findDeadEnd(LOOSE, prefix(51))).toBeNull();
  });

  it("rejects neighbours that are other numbers' givens", () => {
    const puzzle: Puzzle = {
      start: 0,
      grey: new Uint8Array(100),
      givens: new Map([
        [0, 1],
        [1, 7],
        [10, 9],
      ]),
    };
    const d = findDeadEnd(puzzle, [0]);
    expect(d?.kind).toBe('noMove');
    expect([...(d?.rejected ?? [])].sort((a, b) => a - b)).toEqual([1, 10]);
  });

  it('accepts the neighbour that is the given of h+1', () => {
    const grey = new Uint8Array(100);
    grey[1] = 1; // 2 is prime
    const puzzle: Puzzle = {
      start: 0,
      grey,
      givens: new Map([
        [0, 1],
        [1, 2],
        [10, 9],
      ]),
    };
    expect(findDeadEnd(puzzle, [0])).toBeNull();
  });
});

describe('findDeadEnd edge cases', () => {
  it('is null for h = 100', () => {
    expect(findDeadEnd(EASY, prefix(100))).toBeNull();
  });
});

describe.skipIf(skipWithoutLevels())('no false positives on the library', () => {
  it('never flags the reference solution of the first 50 levels (easy)', () => {
    const file = readLevelFile();
    for (let i = 0; i < 50; i++) {
      const level = decodeLevel(file.levels[i], i + 1);
      const puzzle = derivePuzzle(level, 'easy');
      const path = Array.from(level.path);
      for (let h = 1; h <= 100; h++) {
        const trail = path.slice(0, h);
        expect(trailOf(fixtureGrid(trail), puzzle), `trail level ${i + 1} h=${h}`).toEqual(trail);
        expect(findDeadEnd(puzzle, trail), `level ${i + 1} h=${h}`).toBeNull();
      }
    }
  });
});
