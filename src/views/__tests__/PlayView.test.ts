import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { FIXTURE_PATH, FIXTURE_RECORD } from '../../core/__fixtures__/level-fixture';
import { useConfirm } from '../../composables/useConfirm';
import { useLevelStore } from '../../composables/useLevelStore';
import { __resetSettings } from '../../composables/useSettings';
import { useToast } from '../../composables/useToast';
import { installE2eHooks } from '../../e2e-hooks';
import PlayView from '../PlayView.vue';

function fixtureFile() {
  return { schema: 1, libraryVersion: 1, generator: 't', masterSeed: 's', count: 1, levels: [FIXTURE_RECORD] };
}

const wrappers: VueWrapper[] = [];

async function mountAt(path: string): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: defineComponent({ render: () => h('div', { 'data-view': 'home' }) }) },
      {
        path: '/play/:id(\\d+)/:difficulty(easy|advanced|challenge)',
        name: 'play',
        component: PlayView,
        props: true,
      },
    ],
  });
  await router.push(path);
  await router.isReady();
  const wrapper = mount(RouterView, { global: { plugins: [router] }, attachTo: document.body });
  wrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  localStorage.clear();
  __resetSettings();
  useLevelStore().__setLoader(async () => fixtureFile());
  for (const toast of [...useToast().toasts.value]) useToast().dismiss(toast.id);
  useConfirm().pending.value?.settle(false);
});

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = '';
  document.body.className = '';
});

describe('PlayView', () => {
  it('renders the board, status bar and actions for /play/1/easy', async () => {
    const wrapper = await mountAt('/play/1/easy');
    expect(wrapper.find('.pt-board').exists()).toBe(true);
    expect(wrapper.find('.pt-status-bar').text()).toContain('#0001');
    expect(wrapper.find('.pt-play-actions').exists()).toBe(true);
    expect(wrapper.find('.pt-board [data-cell="19"]').text()).toBe('3');
  });

  it('shows the number pad only in direct mode', async () => {
    const wrapper = await mountAt('/play/1/easy');
    expect(wrapper.find('.pt-number-pad').exists()).toBe(false);
    await wrapper.get('.btn-group button[data-mode="direct"]').trigger('click');
    expect(wrapper.find('.pt-number-pad').exists()).toBe(true);
    await wrapper.get('.btn-group button[data-mode="trail"]').trigger('click');
    expect(wrapper.find('.pt-number-pad').exists()).toBe(false);
  });

  it('a press on the board goes through the session', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await wrapper.get(`.pt-board [data-cell="${FIXTURE_PATH[3]}"]`).trigger('pointerdown');
    expect(wrapper.get(`.pt-board [data-cell="${FIXTURE_PATH[3]}"]`).text()).toBe('4');
    expect(wrapper.get('.pt-status-bar').text()).toContain('1');
    expect(wrapper.get('[data-action="undo"]').attributes('disabled')).toBeUndefined();
  });

  it('the view-solution action asks first, then opens the solution', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await wrapper.get('[data-action="viewSolution"]').trigger('click');
    await flushPromises();
    expect(useConfirm().pending.value?.message).toBe('看過解答後，這局不列入最佳紀錄。');
    useConfirm().pending.value!.settle(true);
    await flushPromises();
    expect(document.body.querySelector('.pt-solution')).not.toBeNull();
    expect(wrapper.find('[data-assisted]').exists()).toBe(true);
  });

  it('the PDF action opens the export dialog', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await wrapper.get('[data-action="exportPdf"]').trigger('click');
    await flushPromises();
    expect(document.body.querySelector('[data-include-solution]')).not.toBeNull();
  });

  it('a missing library shows the levelMissing text', async () => {
    useLevelStore().__setLoader(null);
    const wrapper = await mountAt('/play/1/easy');
    expect(wrapper.text()).toContain('找不到這張地圖');
    expect(wrapper.find('.pt-board').exists()).toBe(false);
  });

  it('an id outside the library shows the levelMissing text', async () => {
    const wrapper = await mountAt('/play/2/easy');
    expect(wrapper.text()).toContain('找不到這張地圖');
  });
});

describe('installE2eHooks', () => {
  afterEach(() => {
    delete window.__primeTrail;
  });

  it('is a no-op unless VITE_E2E is 1', () => {
    installE2eHooks(useLevelStore(), {});
    expect(window.__primeTrail).toBeUndefined();
  });

  it('exposes the reference path once the store is ready', async () => {
    installE2eHooks(useLevelStore(), { VITE_E2E: '1' });
    await window.__primeTrail!.ready();
    expect(window.__primeTrail!.solutionOf(1)).toEqual([...FIXTURE_PATH]);
  });

  it('defaults to import.meta.env', () => {
    vi.stubEnv('VITE_E2E', '1');
    try {
      installE2eHooks(useLevelStore());
      expect(window.__primeTrail).toBeDefined();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
