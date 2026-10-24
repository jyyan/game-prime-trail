import { describe, expect, it } from 'vitest';
import { FIXTURE_GREY_CELLS, FIXTURE_PATH } from '../__fixtures__/level-fixture';
import { backbiteStep, greyOf, randomHamiltonianPath, serpentinePath } from '../generator';
import { adjacent, isEdge } from '../geometry';
import { createRng } from '../rng';

// B1-B4 do not import each other, so the Hamiltonian check is local rather than path-codec's.
function expectHamiltonian(path: ArrayLike<number>): void {
  expect(path.length).toBe(100);
  expect(Array.from(path).sort((a, b) => a - b)).toEqual(Array.from({ length: 100 }, (_, i) => i));
  for (let i = 1; i < 100; i++) {
    if (!adjacent(path[i - 1], path[i])) throw new Error(`path[${i - 1}] and path[${i}] not adjacent`);
  }
}

const OPTS = { steps: 100_000, edgeExtraMax: 10_000 };

describe('serpentinePath', () => {
  it('is a boustrophedon Hamiltonian path from 0 to 90', () => {
    const p = serpentinePath();
    expectHamiltonian(p);
    expect(p[0]).toBe(0);
    expect(p[9]).toBe(9);
    expect(p[10]).toBe(19);
    expect(p[99]).toBe(90);
  });
});

describe('backbiteStep', () => {
  it('keeps the path Hamiltonian after every one of 1000 steps', () => {
    const rng = createRng(1);
    const p = serpentinePath();
    for (let i = 0; i < 1000; i++) {
      const before = p.slice();
      backbiteStep(p, rng);
      expectHamiltonian(p);
      expect(p).not.toEqual(before);
    }
  });
});

describe('randomHamiltonianPath', () => {
  it('produces a Hamiltonian path starting on an edge cell', () => {
    const t0 = performance.now();
    const p = randomHamiltonianPath(createRng(20), OPTS);
    const elapsed = performance.now() - t0;
    expect(p).not.toBeNull();
    expectHamiltonian(p!);
    expect(isEdge(p![0])).toBe(true);
    expect(elapsed).toBeLessThan(2000);
  });

  it('is reproducible for the same seed and differs across seeds', () => {
    const a = randomHamiltonianPath(createRng(42), OPTS);
    const b = randomHamiltonianPath(createRng(42), OPTS);
    const c = randomHamiltonianPath(createRng(43), OPTS);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('is diverse over seeds 1..20', () => {
    const paths = Array.from({ length: 20 }, (_, i) => randomHamiltonianPath(createRng(i + 1), OPTS));
    for (const p of paths) {
      expect(p).not.toBeNull();
      expectHamiltonian(p!);
      expect(isEdge(p![0])).toBe(true);
    }
    expect(new Set(paths.map((p) => Array.from(p!).join(','))).size).toBe(20);
    expect(new Set(paths.map((p) => p![0])).size).toBeGreaterThanOrEqual(5);
  });

  it('with zero steps keeps the serpentine and coin-flips between its two edge ends', () => {
    const starts = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const p = randomHamiltonianPath(createRng(seed), { steps: 0, edgeExtraMax: 0 });
      expect(p).not.toBeNull();
      expectHamiltonian(p!);
      starts.add(p![0]);
    }
    expect(starts).toEqual(new Set([0, 90]));
  });

  it('returns null or an edge-start path when no extra steps are allowed', () => {
    let nulls = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const p = randomHamiltonianPath(createRng(seed), { steps: 1000, edgeExtraMax: 0 });
      if (p === null) nulls++;
      else expect(isEdge(p[0])).toBe(true);
    }
    expect(nulls).toBeGreaterThan(0);
  });
});

describe('greyOf', () => {
  it('marks exactly the fixture prime cells', () => {
    const grey = greyOf(FIXTURE_PATH);
    const ones = Array.from(grey.keys()).filter((cell) => grey[cell] === 1);
    expect(ones).toEqual([...FIXTURE_GREY_CELLS]);
  });
});
