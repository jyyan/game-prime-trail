import { readonly, ref, type Ref } from 'vue';

export type ToastVariant = 'info' | 'success' | 'danger';

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  durationMs: number;
}

export interface ToastOptions {
  variant?: ToastVariant;
  /** Auto-dismiss delay; `0` or less keeps the toast until dismissed. */
  durationMs?: number;
}

export const DEFAULT_TOAST_DURATION_MS = 3000;

// Module-level singleton: every caller and the single BsToastHost share one queue.
const toasts = ref<ToastItem[]>([]);
const timers = new Map<number, ReturnType<typeof setTimeout>>();
let nextId = 1;

function dismiss(id: number): void {
  const timer = timers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(id);
  }
  toasts.value = toasts.value.filter((toast) => toast.id !== id);
}

function show(message: string, opts: ToastOptions = {}): number {
  const id = nextId++;
  const durationMs = opts.durationMs ?? DEFAULT_TOAST_DURATION_MS;
  toasts.value = [...toasts.value, { id, message, variant: opts.variant ?? 'info', durationMs }];
  if (durationMs > 0) {
    timers.set(
      id,
      setTimeout(() => dismiss(id), durationMs),
    );
  }
  return id;
}

const readonlyToasts = readonly(toasts) as Readonly<Ref<ToastItem[]>>;

export function useToast(): {
  toasts: Readonly<Ref<ToastItem[]>>;
  show: typeof show;
  dismiss: typeof dismiss;
} {
  return { toasts: readonlyToasts, show, dismiss };
}
