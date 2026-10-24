import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import BsModal from '../BsModal.vue';

const wrappers: VueWrapper[] = [];

function mountModal(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  const wrapper = mount(BsModal, {
    props: { modelValue: false, title: 'Title', ...props },
    slots: { default: '<button class="inner">inner</button>', ...slots },
    attachTo: document.body,
  });
  wrappers.push(wrapper);
  return wrapper;
}

function pressEscape(): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = '';
  document.body.className = '';
});

describe('BsModal', () => {
  it('renders nothing while closed', () => {
    mountModal();
    expect(document.body.querySelector('.modal')).toBeNull();
    expect(document.body.querySelector('.modal-backdrop')).toBeNull();
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });

  it('renders an accessible dialog and backdrop when opened', async () => {
    const wrapper = mountModal();
    await wrapper.setProps({ modelValue: true });
    const modal = document.body.querySelector('.modal.show.d-block');
    expect(modal).not.toBeNull();
    expect(modal?.getAttribute('role')).toBe('dialog');
    expect(modal?.getAttribute('aria-modal')).toBe('true');
    const titleId = modal?.getAttribute('aria-labelledby');
    expect(titleId).toBeTruthy();
    expect(document.getElementById(titleId!)?.textContent).toBe('Title');
    expect(document.body.querySelector('.modal-backdrop.show')).not.toBeNull();
    expect(document.body.classList.contains('modal-open')).toBe(true);
  });

  it('applies size and custom labelledBy', async () => {
    mountModal({ modelValue: true, size: 'lg', labelledBy: 'custom-id' });
    await nextTick();
    expect(document.body.querySelector('.modal-dialog.modal-lg')).not.toBeNull();
    expect(document.body.querySelector('.modal')?.getAttribute('aria-labelledby')).toBe('custom-id');
  });

  it('emits update:modelValue(false) on Escape', async () => {
    const wrapper = mountModal({ modelValue: true });
    await nextTick();
    pressEscape();
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
  });

  it('closes on backdrop click by default', async () => {
    const wrapper = mountModal({ modelValue: true });
    await nextTick();
    document.body.querySelector<HTMLElement>('.modal-backdrop')!.click();
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
  });

  it('ignores backdrop clicks when closeOnBackdrop is false', async () => {
    const wrapper = mountModal({ modelValue: true, closeOnBackdrop: false });
    await nextTick();
    document.body.querySelector<HTMLElement>('.modal-backdrop')!.click();
    document.body.querySelector<HTMLElement>('.modal')!.click();
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('does not treat clicks inside the dialog as backdrop clicks', async () => {
    const wrapper = mountModal({ modelValue: true });
    await nextTick();
    document.body.querySelector<HTMLElement>('.modal-body')!.click();
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('emits close from the header close button', async () => {
    const wrapper = mountModal({ modelValue: true });
    await nextTick();
    document.body.querySelector<HTMLElement>('.btn-close')!.click();
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
  });

  it('renders the footer slot only when provided', async () => {
    const wrapper = mountModal({ modelValue: true });
    await nextTick();
    expect(document.body.querySelector('.modal-footer')).toBeNull();
    wrapper.unmount();
    wrappers.splice(0);
    mountModal({ modelValue: true }, { footer: '<span class="foot">f</span>' });
    await nextTick();
    expect(document.body.querySelector('.modal-footer .foot')).not.toBeNull();
  });

  it('removes modal-open and emits closed after closing', async () => {
    const wrapper = mountModal({ modelValue: true });
    await nextTick();
    await wrapper.setProps({ modelValue: false });
    expect(document.body.classList.contains('modal-open')).toBe(false);
    expect(document.body.querySelector('.modal')).toBeNull();
    expect(wrapper.emitted('closed')).toHaveLength(1);
  });

  it('moves focus into the dialog and restores it after closing', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const wrapper = mountModal();
    await wrapper.setProps({ modelValue: true });
    await nextTick();
    const modal = document.body.querySelector('.modal')!;
    expect(modal.contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.matches('button')).toBe(true);

    await wrapper.setProps({ modelValue: false });
    expect(document.activeElement).toBe(opener);
  });

  it('prefers an [autofocus] element for initial focus', async () => {
    mountModal(
      { modelValue: true },
      { default: '<button class="first">a</button><button class="target" autofocus>b</button>' },
    );
    await nextTick();
    await nextTick();
    expect(document.activeElement?.classList.contains('target')).toBe(true);
  });

  it('only the top-most modal reacts to Escape and modal-open survives the inner close', async () => {
    const outer = mountModal({ modelValue: true, title: 'Outer' });
    await nextTick();
    const inner = mountModal({ modelValue: true, title: 'Inner' });
    await nextTick();
    pressEscape();
    expect(inner.emitted('update:modelValue')).toEqual([[false]]);
    expect(outer.emitted('update:modelValue')).toBeUndefined();

    await inner.setProps({ modelValue: false });
    expect(document.body.classList.contains('modal-open')).toBe(true);
    pressEscape();
    expect(outer.emitted('update:modelValue')).toEqual([[false]]);
  });

  it('stacks by opening order even when mounted in the opposite order', async () => {
    // Mounted first (like the app-level confirm host), opened last.
    const early = mountModal({ title: 'Early' });
    const late = mountModal({ title: 'Late' });
    await late.setProps({ modelValue: true });
    await early.setProps({ modelValue: true });

    const zOf = (selector: string, index: number) =>
      Number(document.body.querySelectorAll<HTMLElement>(selector)[index]!.style.zIndex);
    const modals = document.body.querySelectorAll('.modal');
    // Teleport keeps mount order in the DOM, so the later-opened modal comes first.
    expect(modals[0]!.querySelector('.modal-title')?.textContent).toBe('Early');
    expect(modals[1]!.querySelector('.modal-title')?.textContent).toBe('Late');

    const earlyModal = zOf('.modal', 0);
    const earlyBackdrop = zOf('.modal-backdrop', 0);
    const lateModal = zOf('.modal', 1);
    const lateBackdrop = zOf('.modal-backdrop', 1);
    expect(lateBackdrop).toBeLessThan(lateModal);
    expect(lateModal).toBeLessThan(earlyBackdrop);
    expect(earlyBackdrop).toBeLessThan(earlyModal);

    pressEscape();
    expect(early.emitted('update:modelValue')).toEqual([[false]]);
    expect(late.emitted('update:modelValue')).toBeUndefined();
  });

  it('opens above the current top after a lower modal has closed', async () => {
    const a = mountModal({ title: 'A' });
    const b = mountModal({ title: 'B' });
    const c = mountModal({ title: 'C' });
    await a.setProps({ modelValue: true });
    await b.setProps({ modelValue: true });
    await a.setProps({ modelValue: false });
    await c.setProps({ modelValue: true });

    const zByTitle = (title: string) =>
      Number(
        [...document.body.querySelectorAll<HTMLElement>('.modal')].find(
          (modal) => modal.querySelector('.modal-title')?.textContent === title,
        )!.style.zIndex,
      );
    expect(zByTitle('C')).toBeGreaterThan(zByTitle('B'));
  });

  it('cleans up body state when unmounted while open', async () => {
    const wrapper = mountModal({ modelValue: true });
    await nextTick();
    wrapper.unmount();
    wrappers.splice(0);
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });
});
