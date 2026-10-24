import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimer, type Timer } from '../useTimer';

let hidden = false;
let timer: Timer;

function setHidden(value: boolean): void {
  hidden = value;
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  timer = useTimer({ now: () => Date.now(), doc: document });
});

afterEach(() => {
  timer.dispose();
  vi.useRealTimers();
});

describe('useTimer', () => {
  it('counts after start()', () => {
    timer.start();
    expect(timer.running.value).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(timer.elapsedMs.value).toBe(1000);
  });

  it('reads are exact between interval ticks and always whole milliseconds', () => {
    let t = 0;
    const fine = useTimer({ now: () => t, doc: null });
    fine.start();
    t = 100.4; // no interval tick has fired yet
    expect(fine.elapsedMs.value).toBe(100);
    t = 1100.6;
    expect(fine.elapsedMs.value).toBe(1101);
    expect(Number.isInteger(fine.elapsedMs.value)).toBe(true);
    fine.dispose();
  });

  it('start() while running is a no-op', () => {
    timer.start();
    vi.advanceTimersByTime(500);
    timer.start();
    vi.advanceTimersByTime(500);
    timer.pause();
    expect(timer.elapsedMs.value).toBe(1000);
  });

  it('pause() freezes the value exactly, resume() continues', () => {
    timer.start();
    vi.advanceTimersByTime(1100);
    timer.pause();
    expect(timer.elapsedMs.value).toBe(1100);
    expect(timer.running.value).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(timer.elapsedMs.value).toBe(1100);
    timer.resume();
    expect(timer.running.value).toBe(true);
    vi.advanceTimersByTime(1000);
    timer.pause();
    expect(timer.elapsedMs.value).toBe(2100);
  });

  it('stop() settles the value and resume() does not restart it', () => {
    timer.start();
    vi.advanceTimersByTime(700);
    timer.stop();
    expect(timer.elapsedMs.value).toBe(700);
    timer.resume();
    vi.advanceTimersByTime(1000);
    expect(timer.running.value).toBe(false);
    expect(timer.elapsedMs.value).toBe(700);
  });

  it('reset(61_000) sets the value without starting', () => {
    timer.start();
    vi.advanceTimersByTime(300);
    timer.reset(61_000);
    expect(timer.elapsedMs.value).toBe(61_000);
    expect(timer.running.value).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(timer.elapsedMs.value).toBe(61_000);
    timer.start();
    vi.advanceTimersByTime(1000);
    timer.pause();
    expect(timer.elapsedMs.value).toBe(62_000);
  });

  it('pauses while the document is hidden and continues when visible', () => {
    timer.start();
    vi.advanceTimersByTime(1000);
    setHidden(true);
    expect(timer.elapsedMs.value).toBe(1000);
    vi.advanceTimersByTime(1000);
    expect(timer.elapsedMs.value).toBe(1000);
    expect(timer.running.value).toBe(true);
    setHidden(false);
    vi.advanceTimersByTime(1000);
    expect(timer.elapsedMs.value).toBe(2000);
    timer.pause();
    expect(timer.elapsedMs.value).toBe(2000);
  });

  it('becoming visible does not start a timer that was never started', () => {
    setHidden(true);
    setHidden(false);
    vi.advanceTimersByTime(1000);
    expect(timer.running.value).toBe(false);
    expect(timer.elapsedMs.value).toBe(0);
  });

  it('start() while hidden waits until visible', () => {
    setHidden(true);
    timer.start();
    vi.advanceTimersByTime(1000);
    expect(timer.elapsedMs.value).toBe(0);
    setHidden(false);
    vi.advanceTimersByTime(1000);
    timer.pause();
    expect(timer.elapsedMs.value).toBe(1000);
  });

  it('dispose() stops listening to visibilitychange', () => {
    timer.start();
    vi.advanceTimersByTime(500);
    timer.dispose();
    setHidden(true);
    setHidden(false);
    vi.advanceTimersByTime(1000);
    expect(timer.elapsedMs.value).toBe(500);
  });
});
