/**
 * Fixed generator parameters (spec §4.2–§4.6). Changing any value here changes the generated
 * library, so bump `generator` together with it.
 */
export const GEN_CONFIG = {
  generator: 'backbite/1.0.0',
  masterSeed: 'prime-trail-v1',
  libraryVersion: 1,
  count: 1000,
  backbiteSteps: 100_000,
  edgeExtraMax: 10_000,
  easyBudget: 200_000,
  advBudget: 2_000_000,
  advFloor: 6,
  advRestarts: 3,
  candidates: 3,
  challengeCap: 1000,
  challengeBudget: 5_000_000,
  maxAttemptsPerLevel: 200,
} as const;

/** Same shape as `GEN_CONFIG` with plain value types, so tests can pass smaller budgets. */
export type GenConfig = {
  -readonly [K in keyof typeof GEN_CONFIG]: (typeof GEN_CONFIG)[K] extends string
    ? string
    : number;
};
