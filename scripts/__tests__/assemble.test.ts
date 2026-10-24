// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FIXTURE_AMBIGUOUS_HINT_MASK,
  FIXTURE_RECORD,
} from '../../src/core/__fixtures__/level-fixture';
import { GEN_CONFIG } from '../gen-config';
import { assemble, sha256Hex, verifyLevelFile, writeLevelFiles } from '../lib/assemble';
import { rowConfigOf, type MetaRow } from '../lib/gen-level';

const cfg = { ...GEN_CONFIG, count: 3 };

function rows(ids: number[]): Map<number, MetaRow> {
  return new Map(
    ids.map((id) => [
      id,
      {
        ...FIXTURE_RECORD,
        seed: id,
        id,
        attempt: 0,
        hintCount: 6,
        candidates: [],
        nodes: { easy: 0, adv: 0, chal: 0 },
        ms: 0,
        generator: GEN_CONFIG.generator,
        config: rowConfigOf(GEN_CONFIG),
      },
    ]),
  );
}

describe('assemble', () => {
  it('builds the level file in id order with only record fields', () => {
    const file = assemble(rows([3, 1, 2]), cfg);
    expect(file).toMatchObject({
      schema: 1,
      libraryVersion: 1,
      generator: GEN_CONFIG.generator,
      masterSeed: GEN_CONFIG.masterSeed,
      count: 3,
    });
    expect(file.levels).toHaveLength(3);
    expect(file.levels.map((l) => l.seed)).toEqual([1, 2, 3]);
    expect(Object.keys(file.levels[0]).sort()).toEqual(['c', 'h', 'p', 's', 'seed']);
  });

  it('refuses when an id is missing and names it', () => {
    expect(() => assemble(rows([1, 3]), cfg)).toThrow(/missing id\(s\): 2$/);
  });
});

describe('sha256Hex and writeLevelFiles', () => {
  it('hashes the standard test vector', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('writes compact JSON and a two-line hash file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'prime-trail-assemble-'));
    try {
      const jsonPath = join(dir, 'data', 'levels.json');
      const hashPath = join(dir, 'data', 'levels.hash.txt');
      const file = assemble(rows([1, 2, 3]), cfg);
      writeLevelFiles(file, { jsonPath, hashPath });
      const json = readFileSync(jsonPath, 'utf8');
      expect(json).toBe(`${JSON.stringify(file)}\n`);
      const lines = readFileSync(hashPath, 'utf8').split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toMatch(/^[0-9a-f]{64}$/);
      expect(lines[0]).toBe(sha256Hex(json));
      expect(lines[1]).toBe('libraryVersion=1');
      expect(lines[2]).toBe('');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('verifyLevelFile', () => {
  it('accepts unique fixture levels', () => {
    expect(verifyLevelFile(assemble(rows([1, 2, 3]), cfg))).toEqual([]);
  });

  it('reports an ambiguous advanced puzzle', () => {
    const file = assemble(rows([1, 2, 3]), cfg);
    file.levels[1] = { ...file.levels[1], h: FIXTURE_AMBIGUOUS_HINT_MASK };
    const errors = verifyLevelFile(file);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^level 2: advanced/);
  });

  it('reports structure errors without throwing', () => {
    const file = assemble(rows([1, 2, 3]), cfg);
    file.levels[0] = { ...file.levels[0], p: 'UUU' };
    expect(verifyLevelFile(file).join('\n')).toMatch(/levels\[0\]\.p/);
    const fewHints = assemble(rows([1, 2, 3]), cfg);
    fewHints.levels[2] = { ...fewHints.levels[2], h: 1 << 6 };
    expect(verifyLevelFile(fewHints)).toEqual(['level 3: only 1 advanced hints']);
  });
});
