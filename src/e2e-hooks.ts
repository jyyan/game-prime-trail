import type { LevelStore } from './composables/useLevelStore';

export interface PrimeTrailE2eHooks {
  /** Reference path of level `id`: element k-1 is the cell holding k. */
  solutionOf(id: number): number[];
  /** Resolves once the level library has loaded (or failed to). */
  ready(): Promise<void>;
}

declare global {
  interface Window {
    __primeTrail?: PrimeTrailE2eHooks;
  }
}

/** Spec §12.3: test-only hooks, mounted only when built or served with `VITE_E2E=1`. */
export function installE2eHooks(
  store: LevelStore,
  env: Readonly<Record<string, unknown>> = import.meta.env,
): void {
  if (env['VITE_E2E'] !== '1' || typeof window === 'undefined') return;
  window.__primeTrail = {
    solutionOf(id: number): number[] {
      return Array.from(store.getLevel(id).path);
    },
    ready(): Promise<void> {
      return store.load();
    },
  };
}
