// @vitest-environment node
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FIXTURE_DIRS } from '../../src/core/__fixtures__/level-fixture';
import type { MetaRow } from '../lib/gen-level';
import { appendMeta, readMeta } from '../lib/meta';

function row(id: number, h = 4032): MetaRow {
  return {
    id,
    attempt: 0,
    seed: 1,
    s: 8,
    p: FIXTURE_DIRS,
    h,
    c: null,
    hintCount: 6,
    candidates: [{ attempt: 0, seed: 1, c: null, nodes: 10 }],
    nodes: { easy: 1, adv: 2, chal: 10 },
    ms: 5,
    generator: 'test',
  };
}

describe('meta JSONL', () => {
  let dir: string;
  let path: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'prime-trail-meta-'));
    path = join(dir, 'nested', 'levels.meta.jsonl');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('reads a missing file as empty', () => {
    expect(readMeta(path).size).toBe(0);
  });

  it('reads back appended rows', () => {
    appendMeta(path, row(1));
    appendMeta(path, row(2));
    const rows = readMeta(path);
    expect(rows.size).toBe(2);
    expect(rows.get(2)).toEqual(row(2));
  });

  it('keeps the last line for a repeated id', () => {
    appendMeta(path, row(1));
    appendMeta(path, row(1, 4095));
    const rows = readMeta(path);
    expect(rows.size).toBe(1);
    expect(rows.get(1)?.h).toBe(4095);
  });

  it('skips and counts bad lines', () => {
    appendMeta(path, row(1));
    appendFileSync(path, '{bad json\n');
    appendFileSync(path, '{"id":"x"}\n');
    appendMeta(path, row(3));
    const stats = { bad: 0 };
    const rows = readMeta(path, stats);
    expect([...rows.keys()]).toEqual([1, 3]);
    expect(stats.bad).toBe(2);
  });

  it('does not glue a new row onto a cut-off last line', () => {
    appendMeta(path, row(1));
    appendFileSync(path, '{"id":2,"s":8');
    appendMeta(path, row(3));
    const stats = { bad: 0 };
    expect([...readMeta(path, stats).keys()]).toEqual([1, 3]);
    expect(stats.bad).toBe(1);
  });
});
