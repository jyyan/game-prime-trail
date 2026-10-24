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
}

export type RecomputeField = 'h' | 'c';

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

  // Smallest c wins, null ranks last; candidates are in attempt order so ties keep the earliest.
  const rank = (c: number | null): number => c ?? Number.POSITIVE_INFINITY;
  let chosen = candidates[0];
  for (const cand of candidates) if (rank(cand.c) < rank(chosen.c)) chosen = cand;

  const greedy = greedySearch(chosen.level, chosen.rng, cfg);
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
  };
}

/**
 * `--recompute`: redo `h` and/or `c` for an existing row with the current budgets, keeping its path
 * and seed. The path is rebuilt from `seed` (which also restores the greedy rng state). Candidate
 * selection is not redone: changing `candidates` needs a full regeneration.
 */
export function recomputeRow(row: MetaRow, fields: readonly RecomputeField[], cfg: GenConfig): MetaRow {
  const t0 = performance.now();
  const built = pathForSeed(row.seed, cfg);
  if (!built || built.path[0] !== row.s || encodePath(built.path) !== row.p) {
    throw new Error(`level ${row.id}: seed ${row.seed} no longer reproduces its path`);
  }
  const level = levelOfPath(row.id, built.path, row.seed);
  const next: MetaRow = { ...row, nodes: { ...row.nodes }, candidates: [...row.candidates] };
  if (fields.includes('c')) {
    const chal = challengeCount(level, cfg);
    next.c = chal.c;
    next.nodes.chal = chal.nodes;
    next.candidates = next.candidates.map((cand) =>
      cand.attempt === row.attempt ? { ...cand, c: chal.c, nodes: chal.nodes } : cand,
    );
  }
  if (fields.includes('h')) {
    const greedy = greedySearch(level, built.rng, cfg);
    next.h = greedy.mask;
    next.hintCount = popcount(greedy.mask);
    next.nodes.adv = greedy.nodes;
  }
  next.ms = Math.round(performance.now() - t0);
  next.generator = cfg.generator;
  return next;
}
