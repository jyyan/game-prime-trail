import { beforeEach, describe, expect, it } from 'vitest';
import { storageKey } from '../storage';
import { useRecords } from '../useRecords';

describe('useRecords', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty', () => {
    const records = useRecords(1);
    expect(records.get(1, 'easy')).toBeNull();
    expect(records.completion(1, 'easy')).toBe('none');
    expect(records.all()).toEqual({});
  });

  it('assisted → cleared → slower but shorter (Review Focus 4)', () => {
    const records = useRecords(1);

    const a = records.recordClear(7, 'advanced', { elapsedMs: 60_000, steps: 50, assisted: true });
    expect(a.entry).toMatchObject({ clears: 0, assistedClears: 1, bestMs: null, bestSteps: null });
    expect(a.isNewBest).toEqual({ time: false, steps: false });
    expect(records.completion(7, 'advanced')).toBe('assisted');

    const b = records.recordClear(7, 'advanced', {
      elapsedMs: 90_000,
      steps: 80,
      assisted: false,
    });
    expect(b.entry.clears).toBe(1);
    expect(b.entry.assistedClears).toBe(1);
    expect(b.entry.bestMs).toBe(90_000);
    expect(b.entry.bestSteps).toBe(80);
    expect(b.isNewBest.time && b.isNewBest.steps).toBe(true);
    expect(records.completion(7, 'advanced')).toBe('cleared');

    const c = records.recordClear(7, 'advanced', {
      elapsedMs: 120_000,
      steps: 75,
      assisted: false,
    });
    expect(c.entry.bestMs).toBe(90_000);
    expect(c.entry.bestSteps).toBe(75);
    expect(c.entry.clears).toBe(2);
    expect(c.isNewBest).toEqual({ time: false, steps: true });

    expect(records.get(7, 'advanced')).toEqual(c.entry);
    expect(typeof c.entry.lastClearedAt).toBe('string');
    expect(Object.keys(records.all())).toEqual(['7:advanced']);
  });

  it('keys by difficulty', () => {
    const records = useRecords(1);
    records.recordClear(1, 'easy', { elapsedMs: 1000, steps: 99, assisted: false });
    expect(records.completion(1, 'easy')).toBe('cleared');
    expect(records.get(1, 'challenge')).toBeNull();
  });

  it('persists across instances of the same library version only', () => {
    useRecords(1).recordClear(3, 'easy', { elapsedMs: 1000, steps: 99, assisted: false });
    expect(useRecords(1).get(3, 'easy')?.bestMs).toBe(1000);
    expect(useRecords(2).get(3, 'easy')).toBeNull();
  });

  it('broken JSON reads as empty and does not throw', () => {
    localStorage.setItem(storageKey('records', 1), '{bad');
    const records = useRecords(1);
    expect(() => records.get(1, 'easy')).not.toThrow();
    expect(records.get(1, 'easy')).toBeNull();
    const r = records.recordClear(1, 'easy', { elapsedMs: 5, steps: 99, assisted: false });
    expect(r.isNewBest).toEqual({ time: true, steps: true });
  });

  it('drops malformed entries', () => {
    localStorage.setItem(
      storageKey('records', 1),
      JSON.stringify({
        '1:easy': { bestMs: 'x' },
        '2:easy': { bestMs: 5, bestSteps: 9, clears: 1, assistedClears: 0, lastClearedAt: 't' },
      }),
    );
    const records = useRecords(1);
    expect(records.get(1, 'easy')).toBeNull();
    expect(records.get(2, 'easy')?.bestMs).toBe(5);
  });
});
