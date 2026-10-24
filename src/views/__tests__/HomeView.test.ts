import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { defineComponent } from 'vue';
import { FIXTURE_RECORD } from '../../core/__fixtures__/level-fixture';
import { CELL_COUNT, type SavedProgress } from '../../core/types';
import { useLevelStore } from '../../composables/useLevelStore';
import { useProgress } from '../../composables/useProgress';
import { useRecords } from '../../composables/useRecords';
import { t } from '../../i18n';
import HomeView from '../HomeView.vue';

const Stub = defineComponent({ template: '<div />' });

function fixtureFile(count = 1) {
  return {
    schema: 1,
    libraryVersion: 1,
    generator: 't',
    masterSeed: 's',
    count,
    levels: Array.from({ length: count }, () => FIXTURE_RECORD),
  };
}

function snap(): SavedProgress {
  const grid = new Array<number>(CELL_COUNT).fill(0);
  grid[FIXTURE_RECORD.s] = 1;
  return { grid, steps: 3, elapsedMs: 4000, assisted: false, inputMode: 'trail', savedAt: new Date().toISOString() };
}

let router: Router;

async function mountHome(loader: (() => Promise<unknown>) | null = () => Promise.resolve(fixtureFile())) {
  useLevelStore().__setLoader(loader);
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: HomeView },
      { path: '/play/:id(\\d+)/:difficulty(easy|advanced|challenge)', name: 'play', component: Stub },
    ],
  });
  await router.push('/');
  await router.isReady();
  const wrapper = mount(HomeView, { global: { plugins: [router] } });
  await flushPromises();
  return wrapper;
}

async function typeId(wrapper: Awaited<ReturnType<typeof mountHome>>, id: string) {
  await wrapper.find('input[data-level-id]').setValue(id);
}

describe('HomeView', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('loads the library on mount and renders LevelPicker when ready', async () => {
    const wrapper = await mountHome();
    expect(useLevelStore().status.value).toBe('ready');
    expect(wrapper.find('.pt-level-picker').exists()).toBe(true);
    expect(wrapper.find('[data-state="missing"]').exists()).toBe(false);
  });

  it('marks a normal clear as cleared for the typed id', async () => {
    useRecords(1).recordClear(1, 'easy', { elapsedMs: 1000, steps: 74, assisted: false });
    const wrapper = await mountHome();
    await typeId(wrapper, '1');
    expect(wrapper.find('[data-difficulty="easy"] [data-completion="cleared"]').exists()).toBe(true);
    expect(wrapper.find('[data-difficulty="advanced"] [data-completion="none"]').exists()).toBe(true);
    expect(wrapper.find('[data-difficulty="easy"] [data-best]').text()).toContain('74');
  });

  it('marks an assisted-only clear as assisted', async () => {
    useRecords(1).recordClear(1, 'easy', { elapsedMs: 1000, steps: 74, assisted: true });
    const wrapper = await mountHome();
    await typeId(wrapper, '1');
    expect(wrapper.find('[data-difficulty="easy"] [data-completion="assisted"]').exists()).toBe(true);
  });

  it('shows "continue" for lastPlayed and navigates to it', async () => {
    useProgress(1).save(1, 'advanced', snap());
    const wrapper = await mountHome();
    const resume = wrapper.find('button[data-action="resume"]');
    expect(resume.exists()).toBe(true);
    expect(resume.text()).toContain('#0001・進階');
    await resume.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/play/1/advanced');
  });

  it('hides "continue" when lastPlayed points to a save that no longer exists', async () => {
    useProgress(1).save(1, 'advanced', snap());
    // Drop the progress map but keep the lastPlayed pointer (spec §7.5, backlog R21).
    localStorage.removeItem('prime-trail:v1:L1:progress');
    expect(useProgress(1).lastPlayed()).not.toBeNull();
    const wrapper = await mountHome();
    expect(wrapper.find('button[data-action="resume"]').exists()).toBe(false);
  });

  it('hides "continue" when nothing was played', async () => {
    const wrapper = await mountHome();
    expect(wrapper.find('button[data-action="resume"]').exists()).toBe(false);
  });

  it('start navigates to /play/:id/:difficulty', async () => {
    const wrapper = await mountHome();
    await typeId(wrapper, '1');
    await wrapper.find('button[data-action="start"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/play/1/easy');
  });

  it('random fills an id within 1…count', async () => {
    const wrapper = await mountHome(() => Promise.resolve(fixtureFile(3)));
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await wrapper.find('button[data-action="random"]').trigger('click');
    expect((wrapper.find('input[data-level-id]').element as HTMLInputElement).value).toBe('3');
    vi.spyOn(Math, 'random').mockReturnValue(0);
    await wrapper.find('button[data-action="random"]').trigger('click');
    expect((wrapper.find('input[data-level-id]').element as HTMLInputElement).value).toBe('1');
    expect(wrapper.find('button[data-action="start"]').attributes('disabled')).toBeUndefined();
  });

  it('shows levelMissing when the library is missing', async () => {
    const wrapper = await mountHome(null);
    expect(useLevelStore().status.value).toBe('missing');
    expect(wrapper.find('.pt-level-picker').exists()).toBe(false);
    expect(wrapper.text()).toContain(t('play.levelMissing'));
  });

  it('shows a load error when the library fails to parse', async () => {
    const wrapper = await mountHome(() => Promise.resolve({ schema: 999 }));
    expect(useLevelStore().status.value).toBe('error');
    expect(wrapper.find('.pt-level-picker').exists()).toBe(false);
    expect(wrapper.find('[data-state="error"]').text()).toBe(t('home.loadError'));
  });
});
