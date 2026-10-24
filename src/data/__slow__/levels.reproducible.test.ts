import { describe, expect, it } from 'vitest';
import { randomHamiltonianPath } from '../../core/generator';
import { encodePath } from '../../core/path-codec';
import { createRng } from '../../core/rng';
import { SAMPLE_IDS, readLevelFile } from '../__tests__/helpers';

// Same as scripts/gen-config.ts (backbiteSteps, edgeExtraMax; spec §4.2). Assumes the generator
// draws the path first from a fresh rng seeded with `record.seed`; a mismatch here is a bug in the
// generator script or a drift in the PRNG / backbite algorithm.
const PATH_OPTS = { steps: 100_000, edgeExtraMax: 10_000 };

describe('levels.json reproducibility', () => {
  it.each(SAMPLE_IDS)('level %i regenerates bit-identically from its seed', (id) => {
    const record = readLevelFile().levels[id - 1];
    const path = randomHamiltonianPath(createRng(record.seed), PATH_OPTS);
    expect(path).not.toBeNull();
    expect(path![0]).toBe(record.s);
    expect(encodePath(path!)).toBe(record.p);
  });
});
