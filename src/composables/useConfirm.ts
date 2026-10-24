import { readonly, shallowRef, type Ref } from 'vue';

export interface ConfirmOptions {
  title?: string;
  okLabel?: string;
  cancelLabel?: string;
}

export interface ConfirmRequest extends ConfirmOptions {
  id: number;
  message: string;
  /** Resolves the caller's promise and clears `pending`; later calls are no-ops. */
  settle(ok: boolean): void;
}

// Module-level singleton rendered by the single BsConfirmHost.
const pending = shallowRef<ConfirmRequest | null>(null);
let nextId = 1;

function confirm(message: string, opts: ConfirmOptions = {}): Promise<boolean> {
  // A newer request replaces an unanswered one, which counts as cancelled.
  pending.value?.settle(false);
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const request: ConfirmRequest = {
      ...opts,
      id: nextId++,
      message,
      settle(ok) {
        if (settled) return;
        settled = true;
        if (pending.value === request) pending.value = null;
        resolve(ok);
      },
    };
    pending.value = request;
  });
}

const readonlyPending = readonly(pending) as Readonly<Ref<ConfirmRequest | null>>;

export function useConfirm(): {
  confirm: typeof confirm;
  pending: Readonly<Ref<ConfirmRequest | null>>;
} {
  return { confirm, pending: readonlyPending };
}
