import { dirBetween, step } from './geometry';
import { CELL_COUNT } from './types';
import type { Cell, Direction } from './types';

/**
 * `index` is the offending position: in `decodePath` the index into `dirs`, in `encodePath`
 * the index of the path element the bad step starts from; -1 when the input as a whole is
 * invalid (wrong length, bad start cell).
 */
export class PathCodecError extends Error {
  constructor(
    message: string,
    readonly index: number,
  ) {
    super(message);
    this.name = 'PathCodecError';
  }
}

function isCell(n: unknown): n is Cell {
  return Number.isInteger(n) && (n as number) >= 0 && (n as number) < CELL_COUNT;
}

function isDirection(ch: string): ch is Direction {
  return ch === 'U' || ch === 'D' || ch === 'L' || ch === 'R';
}

export function encodePath(path: Uint8Array | readonly number[]): string {
  if (path.length !== CELL_COUNT) {
    throw new PathCodecError(`path length ${path.length}, expected ${CELL_COUNT}`, -1);
  }
  const seen = new Uint8Array(CELL_COUNT);
  for (let i = 0; i < path.length; i++) {
    if (!isCell(path[i])) throw new PathCodecError(`path[${i}] is not a cell`, i);
    if (seen[path[i]]) throw new PathCodecError(`path[${i}] revisits cell ${path[i]}`, i);
    seen[path[i]] = 1;
  }
  let dirs = '';
  for (let i = 0; i < path.length - 1; i++) {
    const d = dirBetween(path[i], path[i + 1]);
    if (d === null) {
      throw new PathCodecError(`path[${i}]=${path[i]} not adjacent to path[${i + 1}]`, i);
    }
    dirs += d;
  }
  return dirs;
}

export function decodePath(start: Cell, dirs: string): Uint8Array {
  if (!isCell(start)) throw new PathCodecError(`start ${start} is not a cell`, -1);
  if (dirs.length !== CELL_COUNT - 1) {
    throw new PathCodecError(`dirs length ${dirs.length}, expected ${CELL_COUNT - 1}`, -1);
  }
  const path = new Uint8Array(CELL_COUNT);
  const seen = new Uint8Array(CELL_COUNT);
  path[0] = start;
  seen[start] = 1;
  let cur = start;
  for (let i = 0; i < dirs.length; i++) {
    const ch = dirs[i];
    if (!isDirection(ch)) throw new PathCodecError(`dirs[${i}] '${ch}' is not U/D/L/R`, i);
    const next = step(cur, ch);
    if (next === -1) throw new PathCodecError(`dirs[${i}] steps off the board`, i);
    if (seen[next]) throw new PathCodecError(`dirs[${i}] revisits cell ${next}`, i);
    seen[next] = 1;
    path[i + 1] = next;
    cur = next;
  }
  return path;
}

export function isHamiltonianPath(path: ArrayLike<number>): boolean {
  if (path.length !== CELL_COUNT) return false;
  const seen = new Uint8Array(CELL_COUNT);
  for (let i = 0; i < path.length; i++) {
    const cell = path[i];
    if (!isCell(cell) || seen[cell]) return false;
    seen[cell] = 1;
    if (i > 0 && dirBetween(path[i - 1], cell) === null) return false;
  }
  return true;
}
