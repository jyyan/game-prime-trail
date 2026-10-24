import { isEdge } from './geometry';
import { decodePath } from './path-codec';
import { PRIMES, primeIndex } from './primes';
import { CELL_COUNT, CHALLENGE_CAP, SCHEMA_VERSION } from './types';
import type { Cell, Difficulty, Level, LevelFile, LevelRecord, Puzzle } from './types';

const HINT_MASK_LIMIT = 2 ** PRIMES.length;
const DIRS_RE = /^[UDLR]{99}$/;

export function hintMaskToPrimes(mask: number): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < PRIMES.length; i++) {
    if ((mask >>> i) & 1) out.add(PRIMES[i]);
  }
  return out;
}

export function primesToHintMask(primes: Iterable<number>): number {
  let mask = 0;
  for (const p of primes) {
    const i = primeIndex(p);
    if (i === -1) throw new Error(`${p} is not a prime in 2..97`);
    mask |= 1 << i;
  }
  return mask;
}

export function decodeLevel(record: LevelRecord, id: number): Level {
  const path = decodePath(record.s, record.p);
  const numberAt = new Uint8Array(CELL_COUNT);
  for (let k = 1; k <= CELL_COUNT; k++) numberAt[path[k - 1]] = k;
  const grey = new Uint8Array(CELL_COUNT);
  for (const p of PRIMES) grey[path[p - 1]] = 1;
  return {
    id,
    start: path[0],
    path,
    cellOf: path,
    numberAt,
    grey,
    advancedHints: hintMaskToPrimes(record.h),
  };
}

export function derivePuzzle(level: Level, difficulty: Difficulty): Puzzle {
  const givens = new Map<Cell, number>([[level.start, 1]]);
  const shown =
    difficulty === 'easy' ? PRIMES : difficulty === 'advanced' ? [...level.advancedHints] : [];
  for (const p of [...shown].sort((a, b) => a - b)) givens.set(level.path[p - 1], p);
  return { start: level.start, grey: level.grey.slice(), givens };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isIntIn(v: unknown, min: number, maxExclusive: number): v is number {
  return Number.isInteger(v) && (v as number) >= min && (v as number) < maxExclusive;
}

function checkRecord(v: unknown, i: number): LevelRecord {
  const at = `levels[${i}]`;
  if (!isObject(v)) throw new Error(`${at}: not an object`);
  const { s, p, h, c, seed } = v;
  if (!isIntIn(s, 0, CELL_COUNT) || !isEdge(s)) throw new Error(`${at}.s: not an edge cell`);
  if (typeof p !== 'string' || !DIRS_RE.test(p)) {
    throw new Error(`${at}.p: expected 99 chars of U/D/L/R`);
  }
  if (!isIntIn(h, 0, HINT_MASK_LIMIT)) throw new Error(`${at}.h: expected 0 <= h < 2^25`);
  if (c !== null && !isIntIn(c, 1, CHALLENGE_CAP + 1)) {
    throw new Error(`${at}.c: expected null or integer in [1, ${CHALLENGE_CAP}]`);
  }
  if (!isIntIn(seed, 0, 2 ** 32)) throw new Error(`${at}.seed: expected 32-bit unsigned integer`);
  return { s, p, h, c, seed };
}

export function parseLevelFile(json: unknown): LevelFile {
  if (!isObject(json)) throw new Error('level file: not an object');
  const { schema, libraryVersion, generator, masterSeed, count, levels } = json;
  if (schema !== SCHEMA_VERSION) throw new Error(`level file: unsupported schema ${schema}`);
  if (!Number.isInteger(libraryVersion) || (libraryVersion as number) < 1) {
    throw new Error('level file: libraryVersion must be a positive integer');
  }
  if (typeof generator !== 'string') throw new Error('level file: generator must be a string');
  if (typeof masterSeed !== 'string') throw new Error('level file: masterSeed must be a string');
  if (!Array.isArray(levels)) throw new Error('level file: levels must be an array');
  if (count !== levels.length) {
    throw new Error(`level file: count ${count} does not match levels.length ${levels.length}`);
  }
  return {
    schema: SCHEMA_VERSION,
    libraryVersion: libraryVersion as number,
    generator,
    masterSeed,
    count: levels.length,
    levels: levels.map(checkRecord),
  };
}
