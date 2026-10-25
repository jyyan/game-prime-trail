import { describe, expect, it } from 'vitest';
import { readLevelFile, skipWithoutLevels } from '../../data/__tests__/helpers';
import {
  DEMO_LIMITS,
  DEMO_PACING,
  pickDemo,
  playbackMs,
  traceDemo,
  type DemoEvent,
  type DemoReason,
  type DemoTrace,
} from '../demo-solver';
import { decodeLevel, derivePuzzle } from '../level-decode';
import { isSolved } from '../validate';
import type { Cell, Level, Puzzle } from '../types';

// Independent board helpers: the checks below do not use dead-end.ts or demo-solver internals.
const row = (c: Cell): number => Math.floor(c / 10);
const col = (c: Cell): number => c % 10;
const dist = (a: Cell, b: Cell): number => Math.abs(row(a) - row(b)) + Math.abs(col(a) - col(b));
function neighbours(c: Cell): Cell[] {
  const out: Cell[] = [];
  if (row(c) > 0) out.push(c - 10);
  if (row(c) < 9) out.push(c + 10);
  if (col(c) > 0) out.push(c - 1);
  if (col(c) < 9) out.push(c + 1);
  return out;
}
const PRIME_LIST = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97,
];
const prime = (n: number): boolean => PRIME_LIST.includes(n);
const sorted = (cells: readonly Cell[]): Cell[] => [...cells].sort((a, b) => a - b);

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Snapshot {
  grid: Uint8Array;
  head: Cell;
}

/**
 * Replays the trace on an empty board holding 1 on the start, asserting the move rules on the way;
 * calls `onStuck` with the board at each stuck event. Returns the final grid.
 */
function replay(
  trace: DemoTrace,
  puzzle: Puzzle,
  onStuck: (e: Extract<DemoEvent, { type: 'stuck' }>, at: Snapshot) => void = () => {},
): Uint8Array {
  const grid = new Uint8Array(100);
  grid[puzzle.start] = 1;
  const trail: Cell[] = [puzzle.start];
  let stucks = 0;
  let runs = 0;
  let prev: DemoEvent['type'] | null = null;
  for (const e of trace.events) {
    const head = trail[trail.length - 1];
    if (e.type === 'place') {
      expect(neighbours(head)).toContain(e.cell);
      expect(grid[e.cell]).toBe(0);
      expect(e.n).toBe(trail.length + 1);
      grid[e.cell] = e.n;
      trail.push(e.cell);
    } else if (e.type === 'unplace') {
      // always the newest number, never the start
      expect(trail.length).toBeGreaterThan(1);
      expect(e.cell).toBe(head);
      expect(e.n).toBe(trail.length);
      if (prev !== 'unplace') {
        expect(prev).toBe('stuck');
        runs++;
      }
      grid[e.cell] = 0;
      trail.pop();
    } else {
      expect(e.n).toBe(trail.length);
      expect(e.head).toBe(head);
      expect(prev).not.toBe('stuck');
      stucks++;
      onStuck(e, { grid: grid.slice(), head });
    }
    prev = e.type;
  }
  expect(trace.backtracks).toBe(stucks);
  if (trace.solved) {
    expect(runs).toBe(stucks);
    expect(prev).toBe('place');
  }
  return grid;
}

/** Empty cells next to y, plus one if y touches the head. */
function walkable(grid: Uint8Array, y: Cell, head: Cell): number {
  let d = neighbours(y).includes(head) ? 1 : 0;
  for (const z of neighbours(y)) if (!grid[z]) d++;
  return d;
}

/** Checks that `r` is a true reason why number n cannot go on r.cell. */
function checkReason(r: DemoReason, n: number, grid: Uint8Array, puzzle: Puzzle): void {
  const x = r.cell;
  const where = `n=${n} cell=${x} kind=${r.kind}`;
  if (r.kind === 'used') {
    expect(grid[x], where).not.toBe(0);
    return;
  }
  expect(grid[x], where).toBe(0);
  const givenHere = puzzle.givens.get(x);
  if (r.kind === 'otherGiven') {
    expect(givenHere, where).toBeDefined();
    expect(givenHere, where).not.toBe(n);
    expect(r.value, where).toBe(givenHere);
    return;
  }
  const home = [...puzzle.givens].find(([, v]) => v === n)?.[0];
  if (r.kind === 'givenElsewhere') {
    expect(home, where).toBeDefined();
    expect(home, where).not.toBe(x);
    return;
  }
  if (r.kind === 'needPrime') {
    expect(prime(n) && puzzle.grey[x] === 0, where).toBe(true);
    return;
  }
  if (r.kind === 'notPrime') {
    expect(!prime(n) && puzzle.grey[x] === 1, where).toBe(true);
    return;
  }
  // the remaining kinds are about the board after putting n on x
  expect(puzzle.grey[x] === 1, where).toBe(prime(n));
  const next = [...puzzle.givens].filter(([, v]) => v > n).sort((a, b) => a[1] - b[1])[0];
  if (r.kind === 'far') {
    expect(next, where).toBeDefined();
    const [vCell, v] = next;
    expect(r.value, where).toBe(v);
    expect(r.steps, where).toBe(v - n);
    expect(r.dist, where).toBe(dist(x, vCell));
    expect(dist(x, vCell), where).toBeGreaterThan(v - n);
    return;
  }
  const after = grid.slice();
  after[x] = n;
  const empty = [...after.keys()].filter((y) => !after[y]);
  const zero = empty.filter((y) => walkable(after, y, x) === 0);
  const one = empty.filter((y) => walkable(after, y, x) === 1);
  if (r.kind === 'trap') {
    expect(zero.length, where).toBeGreaterThan(0);
    expect(sorted(r.cells ?? []), where).toEqual(zero);
    return;
  }
  if (r.kind === 'twoEnds') {
    expect(zero, where).toEqual([]);
    expect(one.length, where).toBeGreaterThanOrEqual(2);
    expect(sorted(r.cells ?? []), where).toEqual(one);
    return;
  }
  // split: BFS from the new head over empty cells
  const seen = new Set<Cell>([x]);
  const queue = [x];
  while (queue.length > 0) {
    for (const z of neighbours(queue.pop()!)) {
      if (!after[z] && !seen.has(z)) {
        seen.add(z);
        queue.push(z);
      }
    }
  }
  const cut = empty.filter((y) => !seen.has(y));
  expect(cut.length, where).toBeGreaterThan(0);
  expect(sorted(r.cells ?? []), where).toEqual(cut);
}

describe('playbackMs', () => {
  it('adds the pacing of every event of a hand-written trace', () => {
    const P = DEMO_PACING;
    const trace: DemoTrace = {
      solved: false,
      backtracks: 1,
      events: [
        { type: 'place', cell: 1, n: 2 }, // prime
        { type: 'place', cell: 2, n: 3 }, // prime
        { type: 'place', cell: 12, n: 4 },
        {
          type: 'stuck',
          n: 4,
          head: 12,
          reasons: [
            { cell: 2, kind: 'used' },
            { cell: 13, kind: 'needPrime' },
            { cell: 22, kind: 'trap', cells: [21] },
            { cell: 11, kind: 'far', value: 7, dist: 5, steps: 3 },
          ],
        },
        { type: 'unplace', cell: 12, n: 4 },
        { type: 'unplace', cell: 2, n: 3 },
      ],
    };
    const expected =
      P.introMs +
      2 * P.primeMs +
      P.placeMs +
      (P.stuckBaseMs + 3 * P.stuckPerReasonMs) +
      2 * P.unplaceMs +
      (P.branchPauseMs + P.branchMsgMs);
    expect(expected).toBe(2500 + 3600 + 1000 + 9000 + 2000 + 3000);
    expect(playbackMs(trace)).toBe(expected);
  });

  it('is only the intro for an empty trace; an all-used stuck costs the base time', () => {
    expect(playbackMs({ solved: false, backtracks: 0, events: [] })).toBe(DEMO_PACING.introMs);
    const stuck: DemoTrace = {
      solved: false,
      backtracks: 1,
      events: [{ type: 'stuck', n: 1, head: 0, reasons: [{ cell: 1, kind: 'used' }] }],
    };
    expect(playbackMs(stuck)).toBe(2500 + 3000 + 1200 + 1800);
  });
});

describe.skipIf(skipWithoutLevels())('traceDemo on the library', () => {
  const file = skipWithoutLevels() ? null : readLevelFile();
  const level = (id: number): Level => decodeLevel(file!.levels[id - 1], id);

  it('solves the first 50 levels with consistent events and true stuck reasons', () => {
    let stuckChecked = 0;
    for (let id = 1; id <= 50; id++) {
      const lv = level(id);
      const puzzle = derivePuzzle(lv, 'easy');
      const trace = traceDemo(lv);
      expect(trace.events.length).toBeLessThanOrEqual(DEMO_LIMITS.maxEvents);
      const grid = replay(trace, puzzle, (e, at) => {
        const nbs = neighbours(at.head);
        expect(sorted(e.reasons.map((r) => r.cell)), `level ${id}`).toEqual(sorted(nbs));
        for (const r of e.reasons) checkReason(r, e.n + 1, at.grid, puzzle);
        stuckChecked++;
      });
      if (trace.solved) expect(isSolved(grid, puzzle), `level ${id}`).toBe(true);
    }
    expect(stuckChecked).toBeGreaterThan(50);
  });

  it('is deterministic', () => {
    expect(traceDemo(level(2))).toEqual(traceDemo(level(2)));
  });
});

describe.skipIf(skipWithoutLevels())('pickDemo', () => {
  const file = skipWithoutLevels() ? null : readLevelFile();
  const level = (id: number): Level => decodeLevel(file!.levels[id - 1], id);

  // fallback: only the fallback rule accepts it, and with 1 or 5-8 backtracks (not 2-4 with too
  // many events), so the test can tell the two rules apart; other: accepted only as a fallback but
  // with 2-4 backtracks; never: no rule accepts it
  type Class = 'primary' | 'fallback' | 'other' | 'never';
  function classify(trace: DemoTrace): Class {
    const ms = playbackMs(trace);
    if (!trace.solved || ms > DEMO_LIMITS.maxPlaybackMs) return 'never';
    const bt = trace.backtracks;
    if (bt >= 2 && bt <= 4 && trace.events.length <= DEMO_LIMITS.maxPickEvents) return 'primary';
    if (bt === 1 || (bt >= 5 && bt <= 8)) return 'fallback';
    if (bt >= 2 && bt <= 4) return 'other';
    return 'never';
  }
  const pools: Record<Class, number[]> = { primary: [], fallback: [], other: [], never: [] };
  if (file) {
    for (let id = 1; id <= 200; id++) pools[classify(traceDemo(level(id)))].push(id);
  }

  it('finds maps of each kind among the first 200 levels', () => {
    expect(pools.primary.length).toBeGreaterThan(0);
    expect(pools.fallback.length).toBeGreaterThan(2);
    expect(pools.never.length).toBeGreaterThan(20);
  });

  it('is reproducible with a fixed seed and returns a map within the limits', () => {
    for (const seed of [1, 2, 3, 42]) {
      const a = pickDemo(file!.count, level, mulberry32(seed));
      const b = pickDemo(file!.count, level, mulberry32(seed));
      expect(b).toEqual(a);
      expect(a.levelId).toBeGreaterThanOrEqual(1);
      expect(a.levelId).toBeLessThanOrEqual(file!.count);
      expect(a.trace).toEqual(traceDemo(level(a.levelId)));
      expect(a.trace.solved).toBe(true);
      expect(a.trace.backtracks).toBeGreaterThanOrEqual(2);
      expect(a.trace.backtracks).toBeLessThanOrEqual(4);
      expect(a.trace.events.length).toBeLessThanOrEqual(260);
      expect(playbackMs(a.trace)).toBeLessThanOrEqual(360000);
    }
  });

  it('falls back to the 1 or 5-8 backtrack map closest to 2 when no map fits', () => {
    // 40 ids: three fallback maps hidden among maps that never fit
    const fallbacks = pools.fallback.slice(0, 3);
    const ids = [...pools.never.slice(0, 37)];
    ids.splice(5, 0, fallbacks[0]);
    ids.splice(20, 0, fallbacks[1]);
    ids.splice(33, 0, fallbacks[2]);
    const getLevel = (id: number): Level => level(ids[id - 1]);
    const gaps = fallbacks.map((id) => Math.abs(traceDemo(level(id)).backtracks - 2));
    const pick = pickDemo(ids.length, getLevel, mulberry32(7));
    const real = ids[pick.levelId - 1];
    expect(fallbacks).toContain(real);
    expect(pick.trace).toEqual(traceDemo(level(real)));
    expect(classify(pick.trace)).toBe('fallback');
    expect(Math.abs(pick.trace.backtracks - 2)).toBe(Math.min(...gaps));
    expect(playbackMs(pick.trace)).toBeLessThanOrEqual(360000);
  });

  it('throws after two rounds when no map fits at all', () => {
    const ids = pools.never.slice(0, 30);
    const calls: number[] = [];
    const getLevel = (id: number): Level => {
      calls.push(id);
      return level(ids[id - 1]);
    };
    expect(() => pickDemo(ids.length, getLevel, mulberry32(9))).toThrow(Error);
    expect(calls.length).toBe(2 * ids.length);
    expect(new Set(calls.slice(0, ids.length)).size).toBe(ids.length);
  });

  it('draws at most `tries` maps per round', () => {
    const calls: number[] = [];
    const neverId = pools.never[0];
    const getLevel = (id: number): Level => {
      calls.push(id);
      return level(neverId);
    };
    expect(() => pickDemo(500, getLevel, mulberry32(11))).toThrow(Error);
    expect(calls.length).toBe(2 * DEMO_LIMITS.tries);
  });
});
