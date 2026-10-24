import { isEdge, manhattan } from '../../core/geometry';
import { decodeLevel, derivePuzzle } from '../../core/level-decode';
import { decodePath, isHamiltonianPath } from '../../core/path-codec';
import { CELL_COUNT, CHALLENGE_CAP, SCHEMA_VERSION } from '../../core/types';
import type { Difficulty, LevelFile, LevelRecord } from '../../core/types';

export const LEVELS_PATH = 'src/data/levels.json';
export const HASH_PATH = 'src/data/levels.hash.txt';

/** Ids checked by the reproducibility and solution slow tests. */
export const SAMPLE_IDS: readonly number[] = [1, 50, 100, 250, 333, 500, 666, 750, 900, 1000];

export const SKIP_MESSAGE = 'levels.json 尚未生成（D4）, 跳過';

// Raw file text through Vite instead of node:fs: tsconfig.app.json has no Node types. A glob with
// no match yields {}, so a missing library is not an import error. Keys are '/' + the path.
const rawFiles = import.meta.glob<string>(['/src/data/levels.json', '/src/data/levels.hash.txt'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

function readRaw(path: string): string {
  const text = rawFiles[`/${path}`];
  if (text === undefined) throw new Error(`${path} not found`);
  return text;
}

export function hasLevels(): boolean {
  return `/${LEVELS_PATH}` in rawFiles;
}

/** For `describe.skipIf(skipWithoutLevels())`: warns once when the library is missing. */
let warned = false;
export function skipWithoutLevels(): boolean {
  if (hasLevels()) return false;
  if (!warned) console.warn(SKIP_MESSAGE);
  warned = true;
  return true;
}

/** Exact text of levels.json (what the frozen hash covers). */
export function readLevelsText(): string {
  return readRaw(LEVELS_PATH);
}

/** Parsed but not validated, so `checkLevelFile` can report every problem. */
export function readLevelFile(): LevelFile {
  return JSON.parse(readLevelsText()) as LevelFile;
}

/** Hash file: line 1 is the SHA-256 hex of levels.json, line 2 is `libraryVersion=<n>`. */
export function parseHashFile(text: string): { sha256: string; libraryVersion: number } {
  const lines = text.split('\n').map((line) => line.trim());
  const sha256 = lines[0];
  const version = /^libraryVersion=([1-9]\d*)$/.exec(lines[1] ?? '');
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error(`${HASH_PATH}: line 1 is not a SHA-256 hex`);
  if (!version) throw new Error(`${HASH_PATH}: line 2 is not libraryVersion=<n>`);
  if (lines.slice(2).some((line) => line !== '')) throw new Error(`${HASH_PATH}: extra lines`);
  return { sha256, libraryVersion: Number(version[1]) };
}

export function readHashFile(): { sha256: string; libraryVersion: number } {
  return parseHashFile(readRaw(HASH_PATH));
}

function isIntIn(v: unknown, min: number, maxExclusive: number): v is number {
  return Number.isInteger(v) && (v as number) >= min && (v as number) < maxExclusive;
}

/** Consecutive givens (by value) must be reachable: distance <= value gap, same parity. */
function checkGivens(record: LevelRecord, id: number, difficulty: Difficulty): string[] {
  const givens = [...derivePuzzle(decodeLevel(record, id), difficulty).givens].sort(
    (a, b) => a[1] - b[1],
  );
  const errors: string[] = [];
  for (let k = 1; k < givens.length; k++) {
    const [fromCell, fromValue] = givens[k - 1];
    const [toCell, toValue] = givens[k];
    const gap = toValue - fromValue;
    const dist = manhattan(fromCell, toCell);
    if (dist > gap || (gap - dist) % 2 !== 0) {
      errors.push(
        `levels[${id - 1}] ${difficulty}: ${fromValue}@${fromCell} cannot reach ${toValue}@${toCell}`,
      );
    }
  }
  return errors;
}

function checkRecord(v: unknown, i: number): string[] {
  const at = `levels[${i}]`;
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return [`${at}: not an object`];
  const { s, p, h, c, seed } = v as Record<string, unknown>;
  const errors: string[] = [];
  const sOk = isIntIn(s, 0, CELL_COUNT) && isEdge(s);
  const pOk = typeof p === 'string' && /^[UDLR]{99}$/.test(p);
  if (!sOk) errors.push(`${at}.s: ${String(s)} is not an edge cell`);
  if (!pOk) errors.push(`${at}.p: expected 99 chars of U/D/L/R`);
  if (!isIntIn(h, 0, 2 ** 25)) errors.push(`${at}.h: expected integer 0 <= h < 2^25`);
  if (c !== null && !isIntIn(c, 1, CHALLENGE_CAP + 1)) {
    errors.push(`${at}.c: expected null or integer in [1, ${CHALLENGE_CAP}]`);
  }
  if (!isIntIn(seed, 0, 2 ** 32)) errors.push(`${at}.seed: expected 32-bit unsigned integer`);
  if (!sOk || !pOk) return errors;

  try {
    if (!isHamiltonianPath(decodePath(s, p))) errors.push(`${at}.p: not a Hamiltonian path`);
  } catch (e) {
    errors.push(`${at}.p: ${(e as Error).message}`);
    return errors;
  }
  if (errors.length > 0) return errors;
  const record = { s, p, h, c, seed } as LevelRecord;
  return [...checkGivens(record, i + 1, 'easy'), ...checkGivens(record, i + 1, 'advanced')];
}

/**
 * Cheap integrity checks of spec §12.1 (no solver); [] when the file is sound. Values are checked
 * at runtime, so a raw `JSON.parse` result may be passed. Does not require `count === 1000`.
 */
export function checkLevelFile(file: LevelFile): string[] {
  const { schema, libraryVersion, generator, masterSeed, count, levels } = file as unknown as Record<
    string,
    unknown
  >;
  const errors: string[] = [];
  if (schema !== SCHEMA_VERSION) errors.push(`schema: expected ${SCHEMA_VERSION}, got ${schema}`);
  if (!Number.isInteger(libraryVersion) || (libraryVersion as number) < 1) {
    errors.push('libraryVersion: expected a positive integer');
  }
  if (typeof generator !== 'string') errors.push('generator: expected a string');
  if (typeof masterSeed !== 'string') errors.push('masterSeed: expected a string');
  if (!Array.isArray(levels)) return [...errors, 'levels: expected an array'];
  if (count !== levels.length) {
    errors.push(`count: ${count} does not match levels.length ${levels.length}`);
  }
  levels.forEach((record, i) => errors.push(...checkRecord(record, i)));
  return errors;
}

// SHA-256 (FIPS 180-4) over the UTF-8 bytes of `text`; constants are the fractional parts of the
// square / cube roots of the first primes.
const FIRST_PRIMES: number[] = [];
for (let n = 2; FIRST_PRIMES.length < 64; n++) {
  if (FIRST_PRIMES.every((p) => n % p !== 0)) FIRST_PRIMES.push(n);
}
const frac32 = (x: number): number => ((x - Math.floor(x)) * 2 ** 32) >>> 0;
const H0 = FIRST_PRIMES.slice(0, 8).map((p) => frac32(Math.sqrt(p)));
const K = FIRST_PRIMES.map((p) => frac32(Math.cbrt(p)));
const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

export function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bitLength = bytes.length * 8;
  view.setUint32(padded.length - 8, Math.floor(bitLength / 2 ** 32));
  view.setUint32(padded.length - 4, bitLength >>> 0);

  const hash = Uint32Array.from(H0);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + s1 + ch + K[i] + w[i]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    hash[0] += a;
    hash[1] += b;
    hash[2] += c;
    hash[3] += d;
    hash[4] += e;
    hash[5] += f;
    hash[6] += g;
    hash[7] += h;
  }
  return Array.from(hash, (x) => x.toString(16).padStart(8, '0')).join('');
}
