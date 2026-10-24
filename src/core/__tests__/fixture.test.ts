import { describe, expect, it } from 'vitest';
import {
  FIXTURE_ALT_DIRS,
  FIXTURE_ALT_PATH,
  FIXTURE_DIRS,
  FIXTURE_GREY_CELLS,
  FIXTURE_PATH,
  FIXTURE_START,
  fixtureGrid,
  fixturePuzzle,
} from '../__fixtures__/level-fixture';
import { adjacent, isEdge } from '../geometry';
import { PRIMES } from '../primes';

function expectHamiltonian(path: readonly number[]): void {
  expect(path).toHaveLength(100);
  expect([...path].sort((a, b) => a - b)).toEqual(Array.from({ length: 100 }, (_, i) => i));
  for (let i = 1; i < path.length; i++) expect(adjacent(path[i - 1], path[i])).toBe(true);
}

function greyOf(path: readonly number[]): number[] {
  return PRIMES.map((p) => path[p - 1]).sort((a, b) => a - b);
}

describe('fixture', () => {
  it('dirs string is well formed', () => {
    expect(FIXTURE_DIRS).toHaveLength(99);
    expect(FIXTURE_DIRS).toMatch(/^[UDLR]{99}$/);
    expect(FIXTURE_ALT_DIRS).toMatch(/^[UDLR]{99}$/);
  });

  it('path is a Hamiltonian path starting on an edge cell', () => {
    expectHamiltonian(FIXTURE_PATH);
    expect(isEdge(FIXTURE_START)).toBe(true);
    expect(FIXTURE_PATH[0]).toBe(8);
  });

  it('grey cells match primes positions', () => {
    expect(greyOf(FIXTURE_PATH)).toEqual([...FIXTURE_GREY_CELLS]);
  });

  it('alt path is valid, same grey, differs only at indexes 11..17', () => {
    expectHamiltonian(FIXTURE_ALT_PATH);
    expect(greyOf(FIXTURE_ALT_PATH)).toEqual([...FIXTURE_GREY_CELLS]);
    const diff: number[] = [];
    for (let i = 0; i < 100; i++) if (FIXTURE_PATH[i] !== FIXTURE_ALT_PATH[i]) diff.push(i);
    expect(diff.length).toBeGreaterThan(0);
    expect(Math.min(...diff)).toBe(11);
    expect(Math.max(...diff)).toBe(17);
  });

  it('fixturePuzzle', () => {
    expect(fixturePuzzle(PRIMES).givens.size).toBe(26);
    expect([...fixturePuzzle([]).givens]).toEqual([[8, 1]]);
  });

  it('fixtureGrid', () => {
    const g = fixtureGrid(FIXTURE_PATH);
    expect(g[8]).toBe(1);
    expect(g[56]).toBe(100);
  });
});
