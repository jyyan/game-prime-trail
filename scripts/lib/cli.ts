import { availableParallelism } from 'node:os';
import { GEN_CONFIG } from '../gen-config';
import type { RecomputeField } from './gen-level';

export interface CliOptions {
  ids: number[];
  workers: number;
  recompute: RecomputeField[];
  assemble: boolean;
  partial: boolean;
}

/** `1-3,7` → [1, 2, 3, 7]; sorted, deduplicated, each id within 1…count. */
function parseIds(spec: string, count: number): number[] {
  const ids = new Set<number>();
  for (const part of spec.split(',')) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
    if (!m) throw new Error(`--ids: bad range "${part}"`);
    const from = Number(m[1]);
    const to = m[2] === undefined ? from : Number(m[2]);
    if (from < 1 || to > count || from > to) {
      throw new Error(`--ids: range "${part}" is outside 1-${count}`);
    }
    for (let id = from; id <= to; id++) ids.add(id);
  }
  return [...ids].sort((a, b) => a - b);
}

function parseRecompute(spec: string): RecomputeField[] {
  const fields = new Set<RecomputeField>();
  for (const part of spec.split(',')) {
    const f = part.trim();
    if (f !== 'h' && f !== 'c') throw new Error(`--recompute: unknown field "${part}" (expected h, c)`);
    fields.add(f);
  }
  return [...fields];
}

/** Parses `gen-levels.ts` arguments; accepts both `--flag value` and `--flag=value`. Throws on bad input. */
export function parseArgs(argv: string[], count: number = GEN_CONFIG.count): CliOptions {
  const opts: CliOptions = {
    ids: Array.from({ length: count }, (_, i) => i + 1),
    workers: availableParallelism(),
    recompute: [],
    assemble: false,
    partial: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') continue;
    const eq = arg.indexOf('=');
    const name = eq === -1 ? arg : arg.slice(0, eq);
    const value = (): string => {
      if (eq !== -1) return arg.slice(eq + 1);
      const next = argv[++i];
      if (next === undefined) throw new Error(`${name}: missing value`);
      return next;
    };
    switch (name) {
      case '--ids':
        opts.ids = parseIds(value(), count);
        break;
      case '--workers': {
        const raw = value();
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1) throw new Error(`--workers: expected a positive integer, got "${raw}"`);
        opts.workers = n;
        break;
      }
      case '--recompute':
        opts.recompute = parseRecompute(value());
        break;
      case '--assemble':
        opts.assemble = true;
        break;
      case '--partial':
        opts.partial = true;
        break;
      default:
        throw new Error(`unknown argument "${arg}"`);
    }
  }
  return opts;
}
