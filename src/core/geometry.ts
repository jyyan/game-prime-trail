import { BOARD_SIZE } from './types';
import type { Cell, Direction } from './types';

export type EdgeSide = 'top' | 'bottom' | 'left' | 'right';

export const DIRECTIONS: readonly Direction[] = ['U', 'D', 'L', 'R'];

export function rowOf(cell: Cell): number {
  return Math.floor(cell / BOARD_SIZE);
}

export function colOf(cell: Cell): number {
  return cell % BOARD_SIZE;
}

export function cellAt(r: number, c: number): Cell {
  return r * BOARD_SIZE + c;
}

export function isEdge(cell: Cell): boolean {
  const r = rowOf(cell);
  const c = colOf(cell);
  return r === 0 || r === BOARD_SIZE - 1 || c === 0 || c === BOARD_SIZE - 1;
}

export function edgeSides(cell: Cell): ReadonlyArray<EdgeSide> {
  const r = rowOf(cell);
  const c = colOf(cell);
  const sides: EdgeSide[] = [];
  if (r === 0) sides.push('top');
  if (r === BOARD_SIZE - 1) sides.push('bottom');
  if (c === 0) sides.push('left');
  if (c === BOARD_SIZE - 1) sides.push('right');
  return sides;
}

export function color(cell: Cell): 0 | 1 {
  return ((rowOf(cell) + colOf(cell)) % 2) as 0 | 1;
}

export function manhattan(a: Cell, b: Cell): number {
  return Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b));
}

export function adjacent(a: Cell, b: Cell): boolean {
  return manhattan(a, b) === 1;
}

export function step(cell: Cell, dir: Direction): Cell | -1 {
  const r = rowOf(cell);
  const c = colOf(cell);
  switch (dir) {
    case 'U':
      return r > 0 ? cell - BOARD_SIZE : -1;
    case 'D':
      return r < BOARD_SIZE - 1 ? cell + BOARD_SIZE : -1;
    case 'L':
      return c > 0 ? cell - 1 : -1;
    case 'R':
      return c < BOARD_SIZE - 1 ? cell + 1 : -1;
  }
}

export function dirBetween(a: Cell, b: Cell): Direction | null {
  for (const d of DIRECTIONS) {
    if (step(a, d) === b) return d;
  }
  return null;
}

export const NEIGHBORS: ReadonlyArray<readonly Cell[]> = Array.from(
  { length: BOARD_SIZE * BOARD_SIZE },
  (_, cell) => {
    const out: Cell[] = [];
    for (const d of DIRECTIONS) {
      const n = step(cell, d);
      if (n !== -1) out.push(n);
    }
    return out;
  },
);
