import { describe, expect, it } from 'vitest';
import {
  FIXTURE_ALT_DIRS,
  FIXTURE_DIRS,
  FIXTURE_RECORD,
} from '../../core/__fixtures__/level-fixture';
import type { LevelFile, LevelRecord } from '../../core/types';
import { HASH_PATH, LEVELS_PATH, SAMPLE_IDS, checkLevelFile, parseHashFile, sha256Hex } from './helpers';

function fixtureFile(): LevelFile {
  return {
    schema: 1,
    libraryVersion: 1,
    generator: 'backbite/1.0.0',
    masterSeed: 'prime-trail-v1',
    count: 3,
    levels: [
      { ...FIXTURE_RECORD },
      { s: 8, p: FIXTURE_ALT_DIRS, h: 4032, c: 1000, seed: 123 },
      { ...FIXTURE_RECORD, h: 0, c: 1, seed: 2 ** 32 - 1 },
    ],
  };
}

function withLevel0(patch: Partial<Record<keyof LevelRecord, unknown>>): LevelFile {
  const file = fixtureFile();
  file.levels[0] = { ...file.levels[0], ...patch } as LevelRecord;
  return file;
}

function errorsContaining(file: LevelFile, needle: string): string[] {
  const errors = checkLevelFile(file);
  expect(errors.length).toBeGreaterThan(0);
  expect(errors.some((e) => e.includes(needle))).toBe(true);
  return errors;
}

describe('helpers constants', () => {
  it('points at the library files', () => {
    expect(LEVELS_PATH).toBe('src/data/levels.json');
    expect(HASH_PATH).toBe('src/data/levels.hash.txt');
  });

  it('has 10 distinct sample ids in 1..1000', () => {
    expect(SAMPLE_IDS).toHaveLength(10);
    expect(new Set(SAMPLE_IDS).size).toBe(10);
    expect(SAMPLE_IDS.every((id) => Number.isInteger(id) && id >= 1 && id <= 1000)).toBe(true);
  });
});

describe('sha256Hex', () => {
  it('matches the FIPS 180-4 test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('handles inputs across the padding boundary and multiple blocks', () => {
    expect(sha256Hex('a'.repeat(55))).not.toBe(sha256Hex('a'.repeat(56)));
    expect(sha256Hex('a'.repeat(1_000_000))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
    );
  });
});

describe('parseHashFile', () => {
  const hex = sha256Hex('x');

  it('reads the hash and libraryVersion lines', () => {
    expect(parseHashFile(`${hex}\nlibraryVersion=1\n`)).toEqual({ sha256: hex, libraryVersion: 1 });
    expect(parseHashFile(`${hex}\r\nlibraryVersion=12`)).toEqual({
      sha256: hex,
      libraryVersion: 12,
    });
  });

  it('rejects malformed files', () => {
    expect(() => parseHashFile('libraryVersion=1\n')).toThrow(/line 1/);
    expect(() => parseHashFile(`${hex.toUpperCase()}\nlibraryVersion=1\n`)).toThrow(/line 1/);
    expect(() => parseHashFile(`${hex}\n`)).toThrow(/line 2/);
    expect(() => parseHashFile(`${hex}\nlibraryVersion=0\n`)).toThrow(/line 2/);
    expect(() => parseHashFile(`${hex}\nlibraryVersion=1\nmore\n`)).toThrow(/extra/);
  });
});

describe('checkLevelFile', () => {
  it('accepts the 3-level fixture file', () => {
    expect(checkLevelFile(fixtureFile())).toEqual([]);
  });

  it('accepts c = null, c = 1 and c = 1000', () => {
    expect(checkLevelFile(withLevel0({ c: null }))).toEqual([]);
    expect(checkLevelFile(withLevel0({ c: 1 }))).toEqual([]);
    expect(checkLevelFile(withLevel0({ c: 1000 }))).toEqual([]);
  });

  it('rejects a wrong schema', () => {
    errorsContaining({ ...fixtureFile(), schema: 2 } as unknown as LevelFile, 'schema');
  });

  it('rejects a non-positive libraryVersion', () => {
    errorsContaining({ ...fixtureFile(), libraryVersion: 0 }, 'libraryVersion');
  });

  it('rejects a count that does not match levels.length', () => {
    errorsContaining({ ...fixtureFile(), count: 4 }, 'count');
  });

  it('rejects a start that is not an edge cell', () => {
    errorsContaining(withLevel0({ s: 55 }), 'levels[0].s');
  });

  it('rejects a malformed direction string', () => {
    errorsContaining(withLevel0({ p: FIXTURE_DIRS.slice(1) }), 'levels[0].p');
    errorsContaining(withLevel0({ p: `X${FIXTURE_DIRS.slice(1)}` }), 'levels[0].p');
  });

  it('rejects a path that revisits a cell', () => {
    // s = 8, 'R' -> 9, then 'L' instead of 'D' -> back to 8.
    const p = `R${'L'}${FIXTURE_DIRS.slice(2)}`;
    errorsContaining(withLevel0({ p }), 'levels[0].p');
  });

  it('rejects a path that steps off the board', () => {
    errorsContaining(withLevel0({ p: `U${FIXTURE_DIRS.slice(1)}` }), 'levels[0].p');
  });

  it('rejects h outside [0, 2^25)', () => {
    errorsContaining(withLevel0({ h: 2 ** 25 }), 'levels[0].h');
    errorsContaining(withLevel0({ h: -1 }), 'levels[0].h');
    errorsContaining(withLevel0({ h: 1.5 }), 'levels[0].h');
  });

  it('rejects c outside null or [1, 1000]', () => {
    errorsContaining(withLevel0({ c: 0 }), 'levels[0].c');
    errorsContaining(withLevel0({ c: 1001 }), 'levels[0].c');
  });

  it('rejects a seed that is not a 32-bit unsigned integer', () => {
    errorsContaining(withLevel0({ seed: -1 }), 'levels[0].seed');
    errorsContaining(withLevel0({ seed: 2 ** 32 }), 'levels[0].seed');
  });

  it('reports the index of the bad record', () => {
    const file = fixtureFile();
    file.levels[2] = { ...file.levels[2], s: 55 };
    const errors = checkLevelFile(file);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('levels[2].s');
  });

  it('reports a record that is not an object', () => {
    const file = fixtureFile();
    (file.levels as unknown[])[1] = null;
    errorsContaining(file, 'levels[1]');
  });
});
