export type Cell = number;
export type Direction = 'U' | 'D' | 'L' | 'R';
export type Difficulty = 'easy' | 'advanced' | 'challenge';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'advanced', 'challenge'];
export const BOARD_SIZE = 10;
export const CELL_COUNT = 100;
export const CHALLENGE_CAP = 1000;
export const SCHEMA_VERSION = 1;
export interface LevelRecord {
  s: number;
  p: string;
  h: number;
  c: number | null;
  seed: number;
}
export interface LevelFile {
  schema: 1;
  libraryVersion: number;
  generator: string;
  masterSeed: string;
  count: number;
  levels: LevelRecord[];
}
export interface Level {
  id: number;
  start: Cell;
  path: Uint8Array;
  cellOf: Uint8Array;
  numberAt: Uint8Array;
  grey: Uint8Array;
  advancedHints: ReadonlySet<number>;
}
export interface Puzzle {
  start: Cell;
  grey: Uint8Array;
  givens: ReadonlyMap<Cell, number>;
}
export type ConflictKind = 'duplicate' | 'nonAdjacent' | 'primeMismatch' | 'parity';
export interface Conflict {
  cell: Cell;
  kind: ConflictKind;
}
export interface SolveOptions {
  maxSolutions: number;
  maxNodes: number;
  collect?: boolean;
}
export interface SolveResult {
  count: number;
  exhausted: boolean;
  nodes: number;
  solutions?: Uint8Array[];
}
export type InputMode = 'trail' | 'direct';
export type GameStatus = 'idle' | 'playing' | 'won';
export interface Move {
  cell: Cell;
  prev: number;
  next: number;
}
export interface SavedProgress {
  grid: number[];
  steps: number;
  elapsedMs: number;
  assisted: boolean;
  inputMode: InputMode;
  savedAt: string;
}
export interface RecordEntry {
  bestMs: number | null;
  bestSteps: number | null;
  clears: number;
  assistedClears: number;
  lastClearedAt: string;
}
export interface LastPlayed {
  levelId: number;
  difficulty: Difficulty;
  savedAt: string;
}
export interface Settings {
  inputMode: InputMode;
  locale: 'zh-TW';
}
export type Completion = 'none' | 'assisted' | 'cleared';
export interface Rng {
  next(): number;
  int(n: number): number;
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: T[]): T[];
}
