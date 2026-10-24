import { beforeEach, describe, expect, it } from 'vitest';
import { fixturePuzzle } from '../../core/__fixtures__/level-fixture';
import type { SavedProgress } from '../../core/types';
import { storageKey } from '../storage';
import { MAX_PROGRESS_ENTRIES, useProgress } from '../useProgress';

// Challenge-style puzzle: only cell 8 = 1 is given.
const puzzle = fixturePuzzle([]);

function snap(savedAt: string, patch: Partial<SavedProgress> = {}): SavedProgress {
  const grid = new Array<number>(100).fill(0);
  grid[8] = 1;
  grid[9] = 2;
  return { grid, steps: 1, elapsedMs: 1234, assisted: false, inputMode: 'trail', savedAt, ...patch };
}

function iso(i: number): string {
  return new Date(Date.UTC(2026, 9, 1, 0, 0, i)).toISOString();
}

describe('useProgress', () => {
  beforeEach(() => localStorage.clear());

  it('save → load round-trips and sets lastPlayed', () => {
    const progress = useProgress(1);
    const s = snap(iso(0));
    progress.save(5, 'easy', s);
    expect(progress.load(5, 'easy', puzzle)).toEqual(s);
    expect(progress.has(5, 'easy')).toBe(true);
    expect(progress.lastPlayed()).toEqual({ levelId: 5, difficulty: 'easy', savedAt: s.savedAt });
  });

  it('remove clears the save and a lastPlayed pointing at it', () => {
    const progress = useProgress(1);
    progress.save(5, 'easy', snap(iso(0)));
    progress.remove(5, 'easy');
    expect(progress.load(5, 'easy', puzzle)).toBeNull();
    expect(progress.has(5, 'easy')).toBe(false);
    expect(progress.lastPlayed()).toBeNull();
  });

  it('remove keeps lastPlayed when it points elsewhere', () => {
    const progress = useProgress(1);
    progress.save(5, 'easy', snap(iso(0)));
    progress.save(6, 'easy', snap(iso(1)));
    progress.remove(5, 'easy');
    expect(progress.lastPlayed()?.levelId).toBe(6);
  });

  it(`keeps at most ${MAX_PROGRESS_ENTRIES} saves, evicting the oldest savedAt`, () => {
    const progress = useProgress(1);
    for (let i = 1; i <= 21; i++) progress.save(i, 'advanced', snap(iso(i)));
    expect(progress.has(1, 'advanced')).toBe(false);
    for (let i = 2; i <= 21; i++) expect(progress.has(i, 'advanced')).toBe(true);
    expect(progress.lastPlayed()?.levelId).toBe(21);
  });

  it('never evicts the entry being saved even if its savedAt is oldest', () => {
    const progress = useProgress(1);
    for (let i = 1; i <= 20; i++) progress.save(i, 'easy', snap(iso(100 + i)));
    progress.save(99, 'easy', snap(iso(0)));
    expect(progress.has(99, 'easy')).toBe(true);
    expect(progress.has(1, 'easy')).toBe(false);
  });

  it('grid of length 99 → null and deleted (Review Focus 3)', () => {
    const progress = useProgress(1);
    const s = snap(iso(0));
    s.grid.pop();
    progress.save(5, 'easy', s);
    expect(progress.load(5, 'easy', puzzle)).toBeNull();
    expect(progress.has(5, 'easy')).toBe(false);
    expect(progress.lastPlayed()).toBeNull();
  });

  it('given cell mismatch → null and deleted (Review Focus 3)', () => {
    const progress = useProgress(1);
    const s = snap(iso(0));
    s.grid[8] = 2;
    progress.save(5, 'easy', s);
    expect(progress.load(5, 'easy', puzzle)).toBeNull();
    expect(progress.has(5, 'easy')).toBe(false);
  });

  it('out-of-range value → null and deleted', () => {
    const progress = useProgress(1);
    const s = snap(iso(0));
    s.grid[0] = 101;
    progress.save(5, 'easy', s);
    expect(progress.load(5, 'easy', puzzle)).toBeNull();
    expect(progress.has(5, 'easy')).toBe(false);
  });

  it('a library version 2 instance cannot read version 1 saves', () => {
    useProgress(1).save(5, 'easy', snap(iso(0)));
    const v2 = useProgress(2);
    expect(v2.load(5, 'easy', puzzle)).toBeNull();
    expect(v2.has(5, 'easy')).toBe(false);
    expect(v2.lastPlayed()).toBeNull();
    expect(useProgress(1).has(5, 'easy')).toBe(true);
  });

  it('broken JSON reads as no data', () => {
    localStorage.setItem(storageKey('progress', 1), '{bad');
    localStorage.setItem(storageKey('lastPlayed', 1), '{bad');
    const progress = useProgress(1);
    expect(progress.load(5, 'easy', puzzle)).toBeNull();
    expect(progress.lastPlayed()).toBeNull();
  });
});
