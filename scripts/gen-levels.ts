/**
 * Offline level generator (spec §4). Usage:
 *   pnpm gen:levels [--ids 1-1000] [--workers <n>] [--recompute h,c] [--assemble] [--partial]
 * Every finished level is appended to `src/data/levels.meta.jsonl` at once, so an interrupted run
 * resumes where it stopped. `levels.json` is assembled from the meta only when ids 1…count are all
 * present and pass the §4.8 check.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import type { LevelFile } from '../src/core/types';
import { GEN_CONFIG, type GenConfig } from './gen-config';
import { assemble, sha256Hex, verifyLevelFile, writeLevelFiles } from './lib/assemble';
import { parseArgs, type CliOptions } from './lib/cli';
import { isRowCurrent, type MetaRow } from './lib/gen-level';
import { appendMeta, readMeta } from './lib/meta';
import type { WorkerInit, WorkerJob, WorkerReply } from './lib/worker';

const dataFile = (name: string): string => fileURLToPath(new URL(`../src/data/${name}`, import.meta.url));
const META_PATH = dataFile('levels.meta.jsonl');
const JSON_PATH = dataFile('levels.json');
const HASH_PATH = dataFile('levels.hash.txt');
const PARTIAL_PATH = dataFile('levels.partial.json');
const WORKER_URL = new URL('./lib/worker.ts', import.meta.url);

/**
 * Runs jobs on a pool of worker threads, one job per worker at a time. The tsx loader reaches the
 * workers through the inherited `process.execArgv`, so `worker.ts` loads without a build step.
 * Resolves with failure messages once every worker has exited.
 */
function runJobs(jobs: WorkerJob[], workerCount: number, onRow: (row: MetaRow) => void): Promise<string[]> {
  const queue = [...jobs];
  const failures: string[] = [];
  const poolSize = Math.min(workerCount, queue.length);
  if (poolSize === 0) return Promise.resolve(failures);
  return new Promise((resolve) => {
    let alive = poolSize;
    const init: WorkerInit = { cfg: GEN_CONFIG as GenConfig };
    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(WORKER_URL, { workerData: init });
      const feed = (): void => {
        const job = queue.shift();
        if (job) worker.postMessage(job);
        else void worker.terminate();
      };
      worker.on('message', (reply: WorkerReply) => {
        if (reply.ok) onRow(reply.row);
        else failures.push(`level ${reply.id}: ${reply.error}`);
        feed();
      });
      worker.on('error', (err: Error) => failures.push(`worker crashed: ${err.message}`));
      worker.on('exit', () => {
        if (--alive > 0) return;
        if (queue.length > 0) failures.push(`${queue.length} job(s) not run: all workers exited`);
        resolve(failures);
      });
      feed();
    }
  });
}

function bucketOfC(c: number | null): string {
  if (c === null) return 'null';
  if (c >= GEN_CONFIG.challengeCap) return `>=${GEN_CONFIG.challengeCap}`;
  if (c === 1) return '1';
  if (c < 10) return '2-9';
  if (c < 100) return '10-99';
  return `100-${GEN_CONFIG.challengeCap - 1}`;
}

function printStats(rows: MetaRow[]): void {
  const hints = new Map<number, number>();
  const cs = new Map<string, number>();
  for (const row of rows) {
    hints.set(row.hintCount, (hints.get(row.hintCount) ?? 0) + 1);
    cs.set(bucketOfC(row.c), (cs.get(bucketOfC(row.c)) ?? 0) + 1);
  }
  const fmt = (m: Map<string | number, number>): string =>
    [...m].map(([k, n]) => `${k}:${n}`).join(' ');
  const ms = rows.map((r) => r.ms);
  const total = ms.reduce((a, b) => a + b, 0);
  console.log(`levels: ${rows.length}`);
  console.log(`hintCount: ${fmt(new Map([...hints].sort((a, b) => a[0] - b[0])))}`);
  console.log(`c: ${fmt(cs)} (null=${cs.get('null') ?? 0})`);
  if (rows.length > 0) {
    console.log(
      `ms per level: avg ${Math.round(total / rows.length)}, max ${Math.max(...ms)}, total ${total}`,
    );
  }
}

function jobsFor(opts: CliOptions, all: Map<number, MetaRow>, current: Map<number, MetaRow>): WorkerJob[] {
  if (opts.recompute.length > 0) {
    // Recompute works on any existing row (that is how rows survive a budget change); recomputeRow
    // refuses rows whose untouched parameters differ, and those jobs are reported as failures.
    return opts.ids.flatMap((id) => {
      const row = all.get(id);
      return row ? [{ kind: 'recompute' as const, row, fields: opts.recompute }] : [];
    });
  }
  return opts.ids.filter((id) => !current.has(id)).map((id) => ({ kind: 'generate' as const, id }));
}

async function main(): Promise<number> {
  let opts: CliOptions;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error((e as Error).message);
    return 2;
  }
  if (opts.recompute.length > 0 && existsSync(JSON_PATH)) {
    console.error('--recompute is only allowed before release: src/data/levels.json exists (spec §3.5)');
    return 2;
  }

  const metaStats = { bad: 0 };
  const all = readMeta(META_PATH, metaStats);
  if (metaStats.bad > 0) console.warn(`skipped ${metaStats.bad} unreadable meta line(s)`);
  const current = new Map([...all].filter(([, row]) => isRowCurrent(row, GEN_CONFIG)));
  if (current.size < all.size) {
    console.warn(`${all.size - current.size} meta row(s) from other generator parameters are ignored`);
  }

  let failures: string[] = [];
  if (!opts.assemble) {
    const jobs = jobsFor(opts, all, current);
    const workers = Math.min(opts.workers, Math.max(jobs.length, 1));
    console.log(`${jobs.length} job(s) on ${workers} worker(s)`);
    let done = 0;
    const t0 = performance.now();
    failures = await runJobs(jobs, opts.workers, (row) => {
      appendMeta(META_PATH, row);
      all.set(row.id, row);
      current.set(row.id, row);
      done++;
      const { easy, adv, chal } = row.nodes;
      console.log(
        `[${done}/${jobs.length}] id=${row.id} attempt=${row.attempt} hints=${row.hintCount} c=${row.c} ` +
          `nodes=${easy}/${adv}/${chal} ms=${row.ms}`,
      );
    });
    console.log(`wall time ${Math.round(performance.now() - t0)} ms`);
    for (const f of failures) console.error(f);
  }

  const ids = [...current.keys()].sort((a, b) => a - b);
  printStats(ids.map((id) => current.get(id) as MetaRow));

  let exitCode = failures.length > 0 ? 1 : 0;
  const complete = ids.length >= GEN_CONFIG.count && ids.every((id, i) => id === i + 1);
  if (complete) {
    const file = assemble(current, GEN_CONFIG);
    console.log('verifying all levels (easy and advanced uniqueness)...');
    const errors = verifyLevelFile(file);
    if (errors.length > 0) {
      for (const err of errors.slice(0, 20)) console.error(err);
      console.error(`${errors.length} error(s): levels.json not written`);
      exitCode = 1;
    } else {
      writeLevelFiles(file, { jsonPath: JSON_PATH, hashPath: HASH_PATH });
      console.log(`wrote src/data/levels.json, sha256 ${sha256Hex(`${JSON.stringify(file)}\n`)}`);
    }
  } else {
    console.log(`${ids.length}/${GEN_CONFIG.count} levels in meta: levels.json not written`);
    if (opts.assemble) {
      try {
        assemble(current, GEN_CONFIG);
      } catch (e) {
        console.error((e as Error).message);
      }
      exitCode = 1;
    }
  }

  if (opts.partial) {
    // Dev-only file, not checked for uniqueness; levels[i] is the i-th generated id, not id i+1.
    const partial: LevelFile = {
      schema: 1,
      libraryVersion: GEN_CONFIG.libraryVersion,
      generator: GEN_CONFIG.generator,
      masterSeed: GEN_CONFIG.masterSeed,
      count: ids.length,
      levels: ids.map((id) => {
        const { s, p, h, c, seed } = current.get(id) as MetaRow;
        return { s, p, h, c, seed };
      }),
    };
    mkdirSync(fileURLToPath(new URL('../src/data/', import.meta.url)), { recursive: true });
    writeFileSync(PARTIAL_PATH, `${JSON.stringify(partial)}\n`);
    console.log(`wrote src/data/levels.partial.json with ids ${ids.join(',')}`);
  }
  return exitCode;
}

process.exitCode = await main();
