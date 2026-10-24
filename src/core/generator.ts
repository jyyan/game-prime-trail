import { NEIGHBORS, isEdge } from './geometry';
import { PRIMES } from './primes';
import { BOARD_SIZE, CELL_COUNT } from './types';
import type { Cell, Rng } from './types';

const LAST = CELL_COUNT - 1;

/** Boustrophedon path: row 0 left to right, row 1 right to left, ... (`[0] === 0`, `[99] === 90`). */
export function serpentinePath(): Uint8Array {
  const path = new Uint8Array(CELL_COUNT);
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let i = 0; i < BOARD_SIZE; i++) {
      const c = r % 2 === 0 ? i : BOARD_SIZE - 1 - i;
      path[r * BOARD_SIZE + i] = r * BOARD_SIZE + c;
    }
  }
  return path;
}

/**
 * One backbite move, in place (§4.2): pick an endpoint e, pick a grid neighbour x of e that is not
 * e's neighbour along the path, and reverse the segment between e and x so that e becomes adjacent
 * to x in the path. Every endpoint has at least one such neighbour, so the path always changes.
 */
export function backbiteStep(path: Uint8Array, rng: Rng): void {
  const atHead = rng.int(2) === 0;
  const e = atHead ? path[0] : path[LAST];
  const pathNeighbour = atHead ? path[1] : path[LAST - 1];
  const candidates: Cell[] = [];
  for (const n of NEIGHBORS[e]) {
    if (n !== pathNeighbour) candidates.push(n);
  }
  const j = path.indexOf(rng.pick(candidates));
  if (atHead) path.subarray(0, j).reverse();
  else path.subarray(j + 1).reverse();
}

/**
 * Serpentine start, `steps` backbite moves, then further moves until an endpoint is an edge cell
 * (at most `edgeExtraMax`, else `null`). The returned path starts at an edge cell; when both ends are
 * edge cells a coin flip picks which one becomes 1.
 */
export function randomHamiltonianPath(
  rng: Rng,
  opts: { steps: number; edgeExtraMax: number },
): Uint8Array | null {
  const path = serpentinePath();
  for (let i = 0; i < opts.steps; i++) backbiteStep(path, rng);
  for (let extra = 0; !isEdge(path[0]) && !isEdge(path[LAST]); extra++) {
    if (extra >= opts.edgeExtraMax) return null;
    backbiteStep(path, rng);
  }
  const headEdge = isEdge(path[0]);
  const tailEdge = isEdge(path[LAST]);
  const useTail = headEdge && tailEdge ? rng.int(2) === 1 : tailEdge;
  if (useTail) path.reverse();
  return path;
}

/** grey[cell] = 1 iff the cell holds a prime on this path (`path[p-1]` for p in PRIMES). */
export function greyOf(path: ArrayLike<number>): Uint8Array {
  const grey = new Uint8Array(CELL_COUNT);
  for (const p of PRIMES) grey[path[p - 1]] = 1;
  return grey;
}
