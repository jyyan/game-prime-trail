import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  NEIGHBORS,
  adjacent,
  cellAt,
  color,
  colOf,
  dirBetween,
  edgeSides,
  isEdge,
  manhattan,
  rowOf,
  step,
} from '../geometry';

describe('geometry', () => {
  it('cellAt / rowOf / colOf', () => {
    expect(cellAt(3, 4)).toBe(34);
    expect(rowOf(34)).toBe(3);
    expect(colOf(34)).toBe(4);
  });

  it('isEdge: 36 edge cells, 64 interior', () => {
    let edge = 0;
    let inner = 0;
    for (let cell = 0; cell < 100; cell++) {
      if (isEdge(cell)) edge++;
      else inner++;
    }
    expect(edge).toBe(36);
    expect(inner).toBe(64);
  });

  it('edgeSides', () => {
    expect(edgeSides(0)).toEqual(['top', 'left']);
    expect(edgeSides(8)).toEqual(['top']);
    expect(edgeSides(55)).toEqual([]);
  });

  it('color', () => {
    expect(color(8)).toBe(0);
    expect(color(9)).toBe(1);
  });

  it('adjacent', () => {
    expect(adjacent(9, 19)).toBe(true);
    expect(adjacent(9, 10)).toBe(false);
    expect(adjacent(0, 11)).toBe(false);
  });

  it('step', () => {
    expect(step(0, 'U')).toBe(-1);
    expect(step(9, 'R')).toBe(-1);
    expect(step(8, 'R')).toBe(9);
  });

  it('dirBetween', () => {
    expect(dirBetween(8, 9)).toBe('R');
    expect(dirBetween(8, 18)).toBe('D');
    expect(dirBetween(8, 28)).toBeNull();
  });

  it('NEIGHBORS', () => {
    expect(NEIGHBORS).toHaveLength(100);
    expect(NEIGHBORS[0]).toHaveLength(2);
    expect(NEIGHBORS[55]).toHaveLength(4);
  });

  const cellArb = fc.integer({ min: 0, max: 99 });

  it('adjacent is symmetric', () => {
    fc.assert(fc.property(cellArb, cellArb, (a, b) => adjacent(a, b) === adjacent(b, a)));
  });

  it('adjacent iff manhattan is 1', () => {
    fc.assert(fc.property(cellArb, cellArb, (a, b) => adjacent(a, b) === (manhattan(a, b) === 1)));
  });

  it('adjacent implies different colors', () => {
    fc.assert(fc.property(cellArb, cellArb, (a, b) => !adjacent(a, b) || color(a) !== color(b)));
  });
});
