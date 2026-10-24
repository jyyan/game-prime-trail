import { customRef, ref, type Ref } from 'vue';

export interface Timer {
  /** Whole milliseconds, computed from `now()` on every read; writes are ignored. */
  elapsedMs: Ref<number>;
  /** User intent: true between start()/resume() and pause()/stop()/reset(), even while the tab is hidden. */
  running: Ref<boolean>;
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  reset(ms?: number): void;
  dispose(): void;
}

export interface TimerOptions {
  now?: () => number;
  doc?: Document | null;
}

const TICK_MS = 250;

type Phase = 'idle' | 'running' | 'paused' | 'stopped';

/**
 * Elapsed-time counter (spec 7.1, 14): time is accumulated from `now()` deltas, so the
 * interval only refreshes the displayed value and never drifts the total. A hidden document
 * suspends counting without changing the user's intent; becoming visible again continues.
 */
export function useTimer(opts: TimerOptions = {}): Timer {
  const now = opts.now ?? (() => performance.now());
  const doc = opts.doc === undefined ? (typeof document === 'undefined' ? null : document) : opts.doc;

  const running = ref(false);
  let phase: Phase = 'idle';
  let accumulated = 0;
  let segmentStart: number | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;
  let notify: () => void = () => {};

  // Every read settles against now(), so a snapshot taken between ticks is exact; the
  // interval only notifies dependents so the display refreshes.
  const elapsedMs = customRef<number>((track, trigger) => {
    notify = trigger;
    return {
      get() {
        track();
        const live = segmentStart === null ? accumulated : accumulated + (now() - segmentStart);
        return Math.round(live);
      },
      set() {},
    };
  });

  const isHidden = (): boolean => doc?.hidden === true;

  function refresh(): void {
    notify();
  }

  function beginSegment(): void {
    if (segmentStart !== null || isHidden()) return;
    segmentStart = now();
    interval = setInterval(refresh, TICK_MS);
    notify();
  }

  function endSegment(): void {
    if (segmentStart !== null) {
      accumulated += now() - segmentStart;
      segmentStart = null;
    }
    if (interval !== null) {
      clearInterval(interval);
      interval = null;
    }
    notify();
  }

  function start(): void {
    if (running.value) return;
    phase = 'running';
    running.value = true;
    beginSegment();
  }

  function pause(): void {
    if (!running.value) return;
    endSegment();
    phase = 'paused';
    running.value = false;
  }

  function resume(): void {
    if (phase !== 'paused') return;
    start();
  }

  function stop(): void {
    endSegment();
    phase = 'stopped';
    running.value = false;
  }

  function reset(ms = 0): void {
    endSegment();
    accumulated = ms;
    notify();
    phase = 'idle';
    running.value = false;
  }

  function onVisibilityChange(): void {
    if (phase !== 'running') return;
    if (isHidden()) endSegment();
    else beginSegment();
  }

  doc?.addEventListener('visibilitychange', onVisibilityChange);

  function dispose(): void {
    endSegment();
    doc?.removeEventListener('visibilitychange', onVisibilityChange);
  }

  return { elapsedMs, running, start, pause, resume, stop, reset, dispose };
}
