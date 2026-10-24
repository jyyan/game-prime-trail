import { randomHamiltonianPath } from '../../src/core/generator';
import { decodeLevel, derivePuzzle, primesToHintMask } from '../../src/core/level-decode';
import { encodePath } from '../../src/core/path-codec';
import { PRIMES } from '../../src/core/primes';
import { createRng, levelSeed } from '../../src/core/rng';
import { solve } from '../../src/core/solver';
import type { Level, Rng } from '../../src/core/types';
import type { GenConfig } from '../gen-config';

export interface CandidateMeta {
  attempt: number;
  seed: number;
  c: number | null;
  /** Solver nodes of this candidate's challenge count. */
  nodes: number;
}

/** One line of `levels.meta.jsonl`. `s, p, h, c, seed` become the `LevelRecord`; the rest is diagnostics. */
export interface MetaRow {
  id: number;
  attempt: number;
  seed: number;
  s: number;
  p: string;
  h: number;
  c: number | null;
  hintCount: number;
  candidates: CandidateMeta[];
  /** Solver nodes spent on this id: easy checks over all attempts, the greedy search, all challenge counts. */
  nodes: { easy: number; adv: number; chal: number };
  ms: number;
  generator: string;
  /** Every parameter the row depends on, so stale rows are detected even if `generator` was not bumped. */
  config: RowConfig;
}

export type RecomputeField = 'h' | 'c';

/** Parameters that decide the path set and the easy filter, i.e. which candidates exist. */
const PATH_KEYS = [
  'masterSeed',
  'backbiteSteps',
  'edgeExtraMax',
  'easyBudget',
  'candidates',
  'maxAttemptsPerLevel',
] as const;
/** Parameters of the challenge count, which decides the pick among candidates (§4.6). */
const CHAL_KEYS = ['challengeCap', 'challengeBudget'] as const;
/** Parameters of the greedy hint search (§4.5). */
const ADV_KEYS = ['advBudget', 'advFloor', 'advRestarts'] as const;

export type RowConfig = Pick<
  GenConfig,
  (typeof PATH_KEYS)[number] | (typeof CHAL_KEYS)[number] | (typeof ADV_KEYS)[number]
>;

export function rowConfigOf(cfg: GenConfig): RowConfig {
  const out: Partial<Record<keyof RowConfig, string | number>> = {};
  for (const key of [...PATH_KEYS, ...CHAL_KEYS, ...ADV_KEYS]) out[key] = cfg[key];
  return out as RowConfig;
}

/** True when the row was produced with exactly these parameters and generator string. */
export function isRowCurrent(row: MetaRow, cfg: GenConfig): boolean {
  const want = rowConfigOf(cfg);
  return (
    row.generator === cfg.generator &&
    (Object.keys(want) as (keyof RowConfig)[]).every((key) => row.config?.[key] === want[key])
  );
}

type PathConfig = Pick<GenConfig, 'backbiteSteps' | 'edgeExtraMax'>;
type ChallengeConfig = Pick<GenConfig, 'challengeCap' | 'challengeBudget'>;
export type GreedyConfig = Pick<GenConfig, 'advFloor' | 'advBudget'> &
  Partial<Pick<GenConfig, 'advRestarts'>>;

interface Candidate {
  attempt: number;
  seed: number;
  level: Level;
  /** The candidate's own PRNG, left in the state right after backbite; the greedy search continues it. */
  rng: Rng;
  c: number | null;
  chalNodes: number;
}

export function popcount(n: number): number {
  let count = 0;
  for (let v = n; v !== 0; v >>>= 1) count += v & 1;
  return count;
}

/** Backbite path for one seed; the returned rng is what the greedy search must continue (§4.5). */
function pathForSeed(seed: number, cfg: PathConfig): { path: Uint8Array; rng: Rng } | null {
  const rng = createRng(seed);
  const path = randomHamiltonianPath(rng, { steps: cfg.backbiteSteps, edgeExtraMax: cfg.edgeExtraMax });
  return path ? { path, rng } : null;
}

function levelOfPath(id: number, path: Uint8Array, seed: number): Level {
  return decodeLevel({ s: path[0], p: encodePath(path), h: 0, c: null, seed }, id);
}

/** §4.6: solution count of the challenge puzzle; `cap` means at least cap, `null` means budget ran out. */
function challengeCount(level: Level, cfg: ChallengeConfig): { c: number | null; nodes: number } {
  const r = solve(derivePuzzle(level, 'challenge'), {
    maxSolutions: cfg.challengeCap,
    maxNodes: cfg.challengeBudget,
  });
  const c = r.count >= cfg.challengeCap ? cfg.challengeCap : r.exhausted && r.count >= 1 ? r.count : null;
  return { c, nodes: r.nodes };
}

function greedySearch(level: Level, rng: Rng, cfg: GreedyConfig): { mask: number; nodes: number } {
  const restarts = cfg.advRestarts ?? 1;
  let best: Set<number> | null = null;
  let nodes = 0;
  for (let restart = 0; restart < restarts; restart++) {
    const shown = new Set(PRIMES);
    const hinted: Level = { ...level, advancedHints: shown };
    for (const p of rng.shuffle([...PRIMES])) {
      if (shown.size <= cfg.advFloor) break;
      shown.delete(p);
      const r = solve(derivePuzzle(hinted, 'advanced'), { maxSolutions: 2, maxNodes: cfg.advBudget });
      nodes += r.nodes;
      // Not finishing within the budget counts as "not unique": keep the hint.
      if (!(r.count === 1 && r.exhausted)) shown.add(p);
    }
    if (best === null || shown.size < best.size) best = new Set(shown);
  }
  return { mask: primesToHintMask(best ?? PRIMES), nodes };
}

/** §4.5: greedy near-minimal advanced hint subset, as a 25-bit mask. */
export function greedyHintMask(level: Level, rng: Rng, cfg: GreedyConfig): number {
  return greedySearch(level, rng, cfg).mask;
}

/** §4.4–§4.6 for one id. Deterministic in `(cfg, id)` apart from `ms`. */
export function generateLevel(id: number, cfg: GenConfig): MetaRow {
  const t0 = performance.now();
  const candidates: Candidate[] = [];
  let easyNodes = 0;
  let attempt = 0;
  while (candidates.length < cfg.candidates) {
    if (attempt >= cfg.maxAttemptsPerLevel) {
      throw new Error(
        `level ${id}: only ${candidates.length}/${cfg.candidates} candidates after ${attempt} attempts`,
      );
    }
    const seed = levelSeed(cfg.masterSeed, id, attempt);
    const built = pathForSeed(seed, cfg);
    if (built) {
      const level = levelOfPath(id, built.path, seed);
      const easy = solve(derivePuzzle(level, 'easy'), { maxSolutions: 2, maxNodes: cfg.easyBudget });
      easyNodes += easy.nodes;
      if (easy.count === 1 && easy.exhausted) {
        const chal = challengeCount(level, cfg);
        candidates.push({ attempt, seed, level, rng: built.rng, c: chal.c, chalNodes: chal.nodes });
      }
    }
    attempt++;
  }

  const chosen = pickCandidate(candidates);
  const greedy = greedySearch(chosen.level, chosen.rng, cfg);
  return buildRow(id, candidates, chosen, greedy, easyNodes, t0, cfg);
}

/** §4.6: smallest c wins, null ranks last; candidates are in attempt order so ties keep the earliest. */
function pickCandidate(candidates: readonly Candidate[]): Candidate {
  const rank = (c: number | null): number => c ?? Number.POSITIVE_INFINITY;
  let chosen = candidates[0];
  for (const cand of candidates) if (rank(cand.c) < rank(chosen.c)) chosen = cand;
  return chosen;
}

function buildRow(
  id: number,
  candidates: readonly Candidate[],
  chosen: Candidate,
  greedy: { mask: number; nodes: number },
  easyNodes: number,
  t0: number,
  cfg: GenConfig,
): MetaRow {
  return {
    id,
    attempt: chosen.attempt,
    seed: chosen.seed,
    s: chosen.level.start,
    p: encodePath(chosen.level.path),
    h: greedy.mask,
    c: chosen.c,
    hintCount: popcount(greedy.mask),
    candidates: candidates.map((cand) => ({
      attempt: cand.attempt,
      seed: cand.seed,
      c: cand.c,
      nodes: cand.chalNodes,
    })),
    nodes: {
      easy: easyNodes,
      adv: greedy.nodes,
      chal: candidates.reduce((sum, cand) => sum + cand.chalNodes, 0),
    },
    ms: Math.round(performance.now() - t0),
    generator: cfg.generator,
    config: rowConfigOf(cfg),
  };
}

/**
 * `--recompute`: bring an existing row up to the current budgets without redoing the easy checks, with
 * the same result as `generateLevel(row.id, cfg)` (spec §4.3: same generator + masterSeed, same file).
 * - `c`: recounts every recorded candidate (rebuilt from its seed) and re-picks; when the pick moves to
 *   another candidate, the greedy search runs again for it.
 * - `h`: reruns the greedy search with the chosen candidate's rng (rebuilding the path restores it).
 * Parameters outside the requested stages must equal the row's `config`, otherwise the row would not
 * match a fresh run; that throws and the id needs a full regeneration.
 */
export function recomputeRow(row: MetaRow, fields: readonly RecomputeField[], cfg: GenConfig): MetaRow {
  const t0 = performance.now();
  const fixed: (keyof RowConfig)[] = [
    ...PATH_KEYS,
    ...(fields.includes('c') ? [] : CHAL_KEYS),
    ...(fields.includes('h') ? [] : ADV_KEYS),
  ];
  const drift = fixed.filter((key) => row.config?.[key] !== cfg[key]);
  if (drift.length > 0) {
    throw new Error(
      `level ${row.id}: ${drift.join(', ')} differ from the row's config; regenerate it instead of --recompute`,
    );
  }

  const candidates: Candidate[] = row.candidates.map((meta) => {
    const built = meta.seed === levelSeed(cfg.masterSeed, row.id, meta.attempt) ? pathForSeed(meta.seed, cfg) : null;
    if (!built) throw new Error(`level ${row.id}: candidate attempt ${meta.attempt} cannot be rebuilt`);
    return {
      attempt: meta.attempt,
      seed: meta.seed,
      level: levelOfPath(row.id, built.path, meta.seed),
      rng: built.rng,
      c: meta.c,
      chalNodes: meta.nodes,
    };
  });
  const previous = candidates.find((cand) => cand.attempt === row.attempt);
  if (!previous || previous.level.start !== row.s || encodePath(previous.level.path) !== row.p) {
    throw new Error(`level ${row.id}: seed ${row.seed} no longer reproduces its path`);
  }

  if (fields.includes('c')) {
    for (const cand of candidates) {
      const chal = challengeCount(cand.level, cfg);
      cand.c = chal.c;
      cand.chalNodes = chal.nodes;
    }
  }
  const chosen = pickCandidate(candidates);
  const greedy =
    fields.includes('h') || chosen !== previous
      ? greedySearch(chosen.level, chosen.rng, cfg)
      : { mask: row.h, nodes: row.nodes.adv };
  return buildRow(row.id, candidates, chosen, greedy, row.nodes.easy, t0, cfg);
}
