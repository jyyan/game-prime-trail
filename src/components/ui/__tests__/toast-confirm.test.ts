import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { useConfirm } from '../../../composables/useConfirm';
import { useToast } from '../../../composables/useToast';
import BsConfirmHost from '../BsConfirmHost.vue';
import BsToastHost from '../BsToastHost.vue';

const wrappers: VueWrapper[] = [];

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = '';
  document.body.className = '';
});

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    const { toasts, dismiss } = useToast();
    toasts.value.forEach((toast) => dismiss(toast.id));
    vi.useRealTimers();
  });

  it('auto-dismisses after the default 3000 ms', () => {
    const { toasts, show } = useToast();
    show('a');
    expect(toasts.value).toHaveLength(1);
    expect(toasts.value[0]).toMatchObject({ message: 'a', variant: 'info', durationMs: 3000 });
    vi.advanceTimersByTime(2999);
    expect(toasts.value).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(toasts.value).toHaveLength(0);
  });

  it('honours a custom duration', () => {
    const { toasts, show } = useToast();
    show('b', { durationMs: 100 });
    vi.advanceTimersByTime(99);
    expect(toasts.value).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(toasts.value).toHaveLength(0);
  });

  it('returns unique ids and dismisses by id', () => {
    const { toasts, show, dismiss } = useToast();
    const first = show('one');
    const second = show('two', { variant: 'danger' });
    expect(first).not.toBe(second);
    dismiss(first);
    expect(toasts.value.map((toast) => toast.message)).toEqual(['two']);
  });

  it('is shared between callers', () => {
    useToast().show('shared');
    expect(useToast().toasts.value.map((toast) => toast.message)).toEqual(['shared']);
  });

  it('renders toasts in BsToastHost and dismisses via the close button', async () => {
    const wrapper = mount(BsToastHost);
    wrappers.push(wrapper);
    const { show, toasts } = useToast();
    show('a');
    show('ok', { variant: 'success' });
    await nextTick();
    expect(wrapper.find('.toast-container.position-fixed.bottom-0.end-0.p-3').exists()).toBe(true);
    const items = wrapper.findAll('.toast.show[role="status"]');
    expect(items).toHaveLength(2);
    expect(items[0]!.text()).toBe('a');
    expect(items[1]!.classes()).toContain('bg-success');

    await items[0]!.find('.btn-close').trigger('click');
    expect(toasts.value.map((toast) => toast.message)).toEqual(['ok']);
    expect(wrapper.findAll('.toast')).toHaveLength(1);
  });
});

describe('useConfirm', () => {
  function mountHost(): VueWrapper {
    const wrapper = mount(BsConfirmHost, { attachTo: document.body });
    wrappers.push(wrapper);
    return wrapper;
  }

  function button(kind: 'ok' | 'cancel'): HTMLButtonElement {
    return document.body.querySelector<HTMLButtonElement>(`[data-confirm="${kind}"]`)!;
  }

  it('resolves true on OK and false on cancel', async () => {
    mountHost();
    const { confirm, pending } = useConfirm();

    const accepted = confirm('x', { okLabel: 'OK', cancelLabel: 'No' });
    expect(pending.value).not.toBeNull();
    await nextTick();
    expect(document.body.querySelector('.modal-body')?.textContent).toContain('x');
    expect(button('ok').textContent?.trim()).toBe('OK');
    expect(button('cancel').textContent?.trim()).toBe('No');
    button('ok').click();
    await expect(accepted).resolves.toBe(true);
    expect(pending.value).toBeNull();
    await nextTick();
    expect(document.body.querySelector('.modal')).toBeNull();

    const declined = confirm('y', { okLabel: 'OK', cancelLabel: 'No' });
    await nextTick();
    button('cancel').click();
    await expect(declined).resolves.toBe(false);
    expect(pending.value).toBeNull();
  });

  it('resolves false on Escape and on backdrop click', async () => {
    mountHost();
    const { confirm, pending } = useConfirm();

    const viaEscape = confirm('esc');
    await nextTick();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect(viaEscape).resolves.toBe(false);

    await nextTick();
    const viaBackdrop = confirm('backdrop');
    await nextTick();
    document.body.querySelector<HTMLElement>('.modal-backdrop')!.click();
    await expect(viaBackdrop).resolves.toBe(false);
    expect(pending.value).toBeNull();
  });

  it('uses the title when given and the message as label otherwise', async () => {
    mountHost();
    const { confirm, pending } = useConfirm();

    const titled = confirm('body', { title: 'Heading' });
    await nextTick();
    const titledLabel = document.body.querySelector('.modal')!.getAttribute('aria-labelledby')!;
    expect(document.getElementById(titledLabel)?.textContent).toBe('Heading');
    pending.value!.settle(true);
    await titled;
    await nextTick();

    const untitled = confirm('only message');
    await nextTick();
    const untitledLabel = document.body.querySelector('.modal')!.getAttribute('aria-labelledby')!;
    expect(document.getElementById(untitledLabel)?.textContent).toBe('only message');
    pending.value!.settle(false);
    await untitled;
  });

  it('cancels an unanswered request when a new one arrives', async () => {
    const { confirm, pending } = useConfirm();
    const first = confirm('first');
    const second = confirm('second');
    await expect(first).resolves.toBe(false);
    expect(pending.value?.message).toBe('second');
    pending.value!.settle(true);
    await expect(second).resolves.toBe(true);
    await flushPromises();
    expect(pending.value).toBeNull();
  });
});
