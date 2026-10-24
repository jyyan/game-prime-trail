import { describe, expect, it } from 'vitest';
import { readHashFile, readLevelFile, readLevelsText, sha256Hex, skipWithoutLevels } from './helpers';

// Published library is frozen (spec §3.5): any change to levels.json must update levels.hash.txt
// and bump libraryVersion together.
describe.skipIf(skipWithoutLevels())('levels.json frozen hash', () => {
  it('matches the SHA-256 recorded in levels.hash.txt', () => {
    expect(sha256Hex(readLevelsText())).toBe(readHashFile().sha256);
  });

  it('records the same libraryVersion as levels.json', () => {
    expect(readHashFile().libraryVersion).toBe(readLevelFile().libraryVersion);
  });
});
