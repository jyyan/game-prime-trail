import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { manhattan } from '../../src/core/geometry';
import { decodeLevel, derivePuzzle, hintMaskToPrimes, parseLevelFile } from '../../src/core/level-decode';
import { solve } from '../../src/core/solver';
import type { Difficulty, Level, LevelFile } from '../../src/core/types';
import { GEN_CONFIG, type GenConfig } from '../gen-config';
import { popcount, type MetaRow } from './gen-level';

type FileConfig = Pick<GenConfig, 'count' | 'libraryVersion' | 'generator' | 'masterSeed'>;
type VerifyConfig = Pick<GenConfig, 'easyBudget' | 'advBudget' | 'advFloor'>;

/** Builds the level file from meta rows; every id 1…count must be present (index i is id i+1). */
export function assemble(rows: Map<number, MetaRow>, cfg: FileConfig): LevelFile {
  const missing: number[] = [];
  for (let id = 1; id <= cfg.count; id++) if (!rows.has(id)) missing.push(id);
  if (missing.length > 0) {
    throw new Error(`cannot assemble: ${missing.length} missing id(s): ${missing.join(', ')}`);
  }
  const levels = [];
  for (let id = 1; id <= cfg.count; id++) {
    const { s, p, h, c, seed } = rows.get(id) as MetaRow;
    levels.push({ s, p, h, c, seed });
  }
  return {
    schema: 1,
    libraryVersion: cfg.libraryVersion,
    generator: cfg.generator,
    masterSeed: cfg.masterSeed,
    count: cfg.count,
    levels,
  };
}

/** Givens of the puzzle sorted by value must be reachable from each other (distance and parity). */
function unreachableGiven(level: Level): string | null {
  const values = [1, ...[...level.advancedHints].sort((a, b) => a - b)];
  for (let i = 1; i < values.length; i++) {
    const [a, b] = [values[i - 1], values[i]];
    const d = manhattan(level.cellOf[a - 1], level.cellOf[b - 1]);
    if (d > b - a || (b - a - d) % 2 !== 0) return `givens ${a} and ${b} are not reachable`;
  }
  return null;
}

function uniquenessError(level: Level, difficulty: Difficulty, maxNodes: number): string | null {
  const r = solve(derivePuzzle(level, difficulty), { maxSolutions: 2, maxNodes });
  if (r.count === 1 && r.exhausted) return null;
  return `${difficulty} puzzle is not unique (count=${r.count}, exhausted=${r.exhausted})`;
}

/**
 * §4.8 check before writing `levels.json`: the cheap §12.1 structure checks plus easy and advanced
 * uniqueness for every level (slow: runs the solver twice per level). Returns error messages, `[]` if ok.
 */
export function verifyLevelFile(file: LevelFile, cfg: VerifyConfig = GEN_CONFIG): string[] {
  let parsed: LevelFile;
  try {
    parsed = parseLevelFile(file);
  } catch (e) {
    return [(e as Error).message];
  }
  const errors: string[] = [];
  parsed.levels.forEach((record, i) => {
    const id = i + 1;
    let level: Level;
    try {
      level = decodeLevel(record, id);
    } catch (e) {
      errors.push(`level ${id}: ${(e as Error).message}`);
      return;
    }
    const problems = [
      [...hintMaskToPrimes(record.h)].some((p) => level.grey[level.cellOf[p - 1]] !== 1)
        ? 'hint primes outside the grey cells'
        : null,
      popcount(record.h) < cfg.advFloor ? `only ${popcount(record.h)} advanced hints` : null,
      unreachableGiven(level),
      uniquenessError(level, 'easy', cfg.easyBudget),
      uniquenessError(level, 'advanced', cfg.advBudget),
    ];
    for (const problem of problems) if (problem !== null) errors.push(`level ${id}: ${problem}`);
  });
  return errors;
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Writes `levels.json` (compact JSON plus a trailing newline) and the hash file: line 1 is the SHA-256
 * of the exact JSON file content, line 2 `libraryVersion=<n>` (the frozen-hash test checks both, §12.1).
 */
export function writeLevelFiles(file: LevelFile, paths: { jsonPath: string; hashPath: string }): void {
  const json = `${JSON.stringify(file)}\n`;
  mkdirSync(dirname(paths.jsonPath), { recursive: true });
  mkdirSync(dirname(paths.hashPath), { recursive: true });
  writeFileSync(paths.jsonPath, json);
  writeFileSync(paths.hashPath, `${sha256Hex(json)}\nlibraryVersion=${file.libraryVersion}\n`);
}
