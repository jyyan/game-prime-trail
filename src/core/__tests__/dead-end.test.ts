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

  it('is null when a given number below the head sits on an unvisited cell', () => {
    const elsewhere = FIXTURE_PATH[10];
    const puzzle: Puzzle = {
      ...LOOSE,
      givens: new Map([...LOOSE.givens, [elsewhere, 3]]),
    };
    expect(trailOf(fixtureGrid(prefix(3)), puzzle)).toBeNull();
    expect(trailOf(fixtureGrid(prefix(2)), puzzle)).toEqual(prefix(2));
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
    // reference prefix of 39, then the detour 61, 60, 50 leaves cell 70 with no free neighbour
    expect(findDeadEnd(LOOSE, [...prefix(39), 61, 60, 50])).toEqual({
      kind: 'trap',
      cells: [70],
      rejected: [],
    });
  });

  it('does not flag it while the head is still next to the cell', () => {
    expect(findDeadEnd(LOOSE, [...prefix(39), 61, 60])).toBeNull();
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
    // reference prefix of 45, then 21, 22, 12, 2, 3 cuts off the top-left block
    expect(findDeadEnd(LOOSE, [...prefix(45), 21, 22, 12, 2, 3])).toEqual({
      kind: 'split',
      cells: [0, 1, 10, 11],
      rejected: [],
    });
  });

  it('is null while the head still touches the block', () => {
    expect(findDeadEnd(LOOSE, [...prefix(45), 21, 22, 12, 2])).toBeNull();
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

  it("rejects neighbours that are other numbers' givens even when the colour matches", () => {
    // 2 is prime, so grey neighbours match the colour; only the givens (7, 9) rule them out
    const grey = new Uint8Array(100);
    grey[1] = 1;
    grey[10] = 1;
    const puzzle: Puzzle = {
      start: 0,
      grey,
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

  it('accepts the neighbour that is the given of h+1 and rejects the other given', () => {
    const grey = new Uint8Array(100);
    grey[1] = 1;
    grey[10] = 1; // both colours match 2; only the givens differ
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
    // nobody holds the given 2 any more, so both neighbours are rejected by their givens
    const none: Puzzle = { ...puzzle, givens: new Map([[0, 1], [1, 9], [10, 8]]) };
    expect(findDeadEnd(none, [0])?.kind).toBe('noMove');
  });

  it('only the cell of h+1 may take it when h+1 is a given', () => {
    // 2 is a given on cell 1, but cell 1 has the wrong colour; free cell 10 must not take it
    const grey = new Uint8Array(100);
    grey[10] = 1; // 2 is prime
    const puzzle: Puzzle = {
      start: 0,
      grey,
      givens: new Map([
        [0, 1],
        [1, 2],
      ]),
    };
    const d = findDeadEnd(puzzle, [0]);
    expect(d?.kind).toBe('noMove');
    expect([...(d?.rejected ?? [])].sort((a, b) => a - b)).toEqual([1, 10]);
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
