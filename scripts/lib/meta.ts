import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
} from 'node:fs';
import { dirname } from 'node:path';
import type { MetaRow } from './gen-level';

function isRow(v: unknown): v is MetaRow {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const row = v as Record<string, unknown>;
  return (
    Number.isInteger(row.id) &&
    (row.id as number) >= 1 &&
    Number.isInteger(row.s) &&
    typeof row.p === 'string' &&
    Number.isInteger(row.h) &&
    (row.c === null || Number.isInteger(row.c)) &&
    Number.isInteger(row.seed)
  );
}

/**
 * Reads `levels.meta.jsonl`. A later line for the same id replaces an earlier one; lines that are
 * not valid JSON rows (e.g. a line cut off by an interrupted run) are skipped and counted in `stats.bad`.
 * A missing file is an empty map.
 */
export function readMeta(path: string, stats: { bad: number } = { bad: 0 }): Map<number, MetaRow> {
  const rows = new Map<number, MetaRow>();
  if (!existsSync(path)) return rows;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.trim() === '') continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      stats.bad++;
      continue;
    }
    if (isRow(parsed)) rows.set(parsed.id, parsed);
    else stats.bad++;
  }
  return rows;
}

/** True when the file exists, is non-empty and its last byte is not a newline (a cut-off last line). */
function endsMidLine(path: string): boolean {
  if (!existsSync(path)) return false;
  const { size } = statSync(path);
  if (size === 0) return false;
  const fd = openSync(path, 'r');
  try {
    const last = Buffer.alloc(1);
    readSync(fd, last, 0, 1, size - 1);
    return last[0] !== 0x0a;
  } finally {
    closeSync(fd);
  }
}

/**
 * Appends one row as a single JSON line, creating the directory if needed. If an interrupted run
 * left a cut-off last line, a newline is written first so the new row does not merge into it.
 */
export function appendMeta(path: string, row: MetaRow): void {
  mkdirSync(dirname(path), { recursive: true });
  const prefix = endsMidLine(path) ? '\n' : '';
  appendFileSync(path, `${prefix}${JSON.stringify(row)}\n`);
}
