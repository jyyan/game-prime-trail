import { describe, expect, it } from 'vitest';
import { checkLevelFile, readLevelFile, skipWithoutLevels } from './helpers';

describe.skipIf(skipWithoutLevels())('levels.json integrity', () => {
  it('passes the cheap checks of spec §12.1 within 2 s', () => {
    const started = performance.now();
    const file = readLevelFile();
    const errors = checkLevelFile(file);
    const duration = performance.now() - started;

    expect(errors).toEqual([]);
    expect(duration).toBeLessThan(2000);
  });

  it('has a positive integer libraryVersion and exactly 1000 levels', () => {
    const file = readLevelFile();
    expect(Number.isInteger(file.libraryVersion) && file.libraryVersion >= 1).toBe(true);
    expect(file.count).toBe(1000);
    expect(file.levels).toHaveLength(1000);
  });
});
