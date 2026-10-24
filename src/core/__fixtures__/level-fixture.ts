import type { LevelRecord, Puzzle } from '../types';

export const FIXTURE_START = 8;
export const FIXTURE_DIRS =
  'RDDDDDLDRDLLDRRDLLLUULLLDRRDLLLLLURRULLUUUUUUURRRDLLDDDDDRRRRRRUURULLDLUUURDRRULULLLDDDLULDDDRURDRR';
export const FIXTURE_PATH: readonly number[] = [
  8, 9, 19, 29, 39, 49, 59, 58, 68, 69, 79, 78, 77, 87, 88, 89, 99, 98, 97, 96, 86, 76, 75, 74, 73,
  83, 84, 85, 95, 94, 93, 92, 91, 90, 80, 81, 82, 72, 71, 70, 60, 50, 40, 30, 20, 10, 0, 1, 2, 3,
  13, 12, 11, 21, 31, 41, 51, 61, 62, 63, 64, 65, 66, 67, 57, 47, 48, 38, 37, 36, 46, 45, 35, 25,
  15, 16, 26, 27, 28, 18, 17, 7, 6, 5, 4, 14, 24, 34, 33, 23, 22, 32, 42, 52, 53, 43, 44, 54, 55,
  56,
];
export const FIXTURE_GREY_CELLS: readonly number[] = [
  0, 6, 9, 11, 19, 28, 33, 35, 39, 40, 44, 46, 48, 59, 60, 62, 64, 75, 77, 79, 82, 93, 95, 97, 99,
];
export const FIXTURE_ADVANCED_HINT_MASK = 4032; // primes {17,19,23,29,31,37} (bits 6..11); unique solution
export const FIXTURE_AMBIGUOUS_HINT_MASK = 33554304; // primes >= 19 (bits 7..24); exactly 2 solutions
export const FIXTURE_RECORD: LevelRecord = { s: 8, p: FIXTURE_DIRS, h: 4032, c: null, seed: 0 };
export const FIXTURE_ALT_DIRS =
  'RDDDDDLDRDDDLUULDDLUULLLDRRDLLLLLURRULLUUUUUUURRRDLLDDDDDRRRRRRUURULLDLUUURDRRULULLLDDDLULDDDRURDRR';
export const FIXTURE_ALT_PATH: readonly number[] = [
  8, 9, 19, 29, 39, 49, 59, 58, 68, 69, 79, 89, 99, 98, 88, 78, 77, 87, 97, 96, 86, 76, 75, 74, 73,
  83, 84, 85, 95, 94, 93, 92, 91, 90, 80, 81, 82, 72, 71, 70, 60, 50, 40, 30, 20, 10, 0, 1, 2, 3,
  13, 12, 11, 21, 31, 41, 51, 61, 62, 63, 64, 65, 66, 67, 57, 47, 48, 38, 37, 36, 46, 45, 35, 25,
  15, 16, 26, 27, 28, 18, 17, 7, 6, 5, 4, 14, 24, 34, 33, 23, 22, 32, 42, 52, 53, 43, 44, 54, 55,
  56,
];
// Verified properties: easy puzzle has a unique solution; {1} + primes >= 19 has exactly 2 solutions
// (the other is FIXTURE_ALT_PATH, differing only at numbers 12-18); {1, 17} alone is still unique;
// the challenge puzzle (only 1 given) has >= 2 solutions; cell 9 (the number 2) is the only grey cell next to the start.

/** grid[path[k-1]] = k */
export function fixtureGrid(path: readonly number[]): Uint8Array {
  const grid = new Uint8Array(100);
  for (let k = 1; k <= path.length; k++) grid[path[k - 1]] = k;
  return grid;
}

/** start=8; grey from FIXTURE_GREY_CELLS; givens = {8->1} + {FIXTURE_PATH[p-1] -> p} */
export function fixturePuzzle(shownPrimes: Iterable<number>): Puzzle {
  const grey = new Uint8Array(100);
  for (const cell of FIXTURE_GREY_CELLS) grey[cell] = 1;
  const givens = new Map<number, number>();
  givens.set(FIXTURE_START, 1);
  for (const p of shownPrimes) givens.set(FIXTURE_PATH[p - 1], p);
  return { start: FIXTURE_START, grey, givens };
}
