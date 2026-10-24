<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import LevelPicker from '../components/picker/LevelPicker.vue';
import { useLevelStore } from '../composables/useLevelStore';
import { useProgress } from '../composables/useProgress';
import { useRecords } from '../composables/useRecords';
import { isPlainObject, readJson, writeJson } from '../composables/storage';
import type { Completion, Difficulty, LastPlayed, RecordEntry } from '../core/types';
import { t } from '../i18n';

/** UI preferences (UI refresh spec §5.2); not scoped by library version, like settings. */
const UI_KEY = 'prime-trail:v1:ui';

const store = useLevelStore();
const { status, count, libraryVersion } = store;
const router = useRouter();
const levelId = ref<number | null>(null);

// Records and progress are keyed by library version (spec §7.5), so they exist only once ready.
const version = computed(() => (status.value === 'ready' ? libraryVersion.value : null));
const records = computed(() => (version.value === null ? null : useRecords(version.value)));
const progress = computed(() => (version.value === null ? null : useProgress(version.value)));

function completion(id: number, d: Difficulty): Completion {
  return records.value?.completion(id, d) ?? 'none';
}

function best(id: number, d: Difficulty): RecordEntry | null {
  return records.value?.get(id, d) ?? null;
}

const lastPlayed = computed<LastPlayed | null>(() => progress.value?.lastPlayed() ?? null);

// `lastPlayed` is a raw pointer; hide "continue" when its save is gone (spec §7.5, backlog R21).
const canResume = computed(() => {
  const last = lastPlayed.value;
  const p = progress.value;
  return last !== null && p !== null && p.has(last.levelId, last.difficulty);
});

// Rules card: expanded until the player collapses it, then remembered across visits.
// Other fields stored under the same key are kept when the flag is written.
function readUi(): Record<string, unknown> {
  return readJson(UI_KEY, isPlainObject) ?? {};
}
const rulesCollapsed = ref(readUi().rulesCollapsed === true);
const rulesId = 'pt-home-rules';

function toggleRules(): void {
  rulesCollapsed.value = !rulesCollapsed.value;
  writeJson(UI_KEY, { ...readUi(), rulesCollapsed: rulesCollapsed.value });
}

function onRandom(): void {
  // randomId() throws unless the store is ready (backlog R22).
  if (status.value === 'ready') levelId.value = store.randomId();
}

function goPlay(id: number, difficulty: Difficulty): void {
  void router.push({ name: 'play', params: { id: String(id), difficulty } });
}

onMounted(() => {
  void store.load();
});
</script>

<template>
  <section data-view="home" class="pt-home mx-auto py-3">
    <header class="pt-hero text-center mb-3">
      <img
        class="pt-hero-img"
        src="/illustrations/hero.webp"
        width="1600"
        height="1000"
        :alt="t('home.heroAlt')"
        data-hero
      />
      <h1 class="pt-hero-title pt-num mb-1">{{ t('home.title') }}</h1>
      <p class="pt-muted mb-0">{{ t('home.subtitle') }}</p>
    </header>

    <section class="pt-card mb-3" data-rules :data-collapsed="rulesCollapsed ? 'true' : 'false'">
      <button
        type="button"
        class="pt-rules-toggle d-flex justify-content-between align-items-center w-100"
        data-action="toggleRules"
        :aria-expanded="rulesCollapsed ? 'false' : 'true'"
        :aria-controls="rulesId"
        @click="toggleRules"
      >
        <h2 class="h6 fw-bold mb-0">{{ t('home.rulesTitle') }}</h2>
        <span class="pt-muted small">{{ rulesCollapsed ? t('home.rulesShow') : t('home.rulesHide') }}</span>
      </button>
      <ol v-show="!rulesCollapsed" :id="rulesId" class="pt-rules mb-0 mt-2" data-rules-body>
        <li>{{ t('home.rule1') }}</li>
        <li>{{ t('home.rule2') }}</li>
        <li>{{ t('home.rule3') }}</li>
      </ol>
    </section>

    <div v-if="status === 'ready'" class="pt-card">
      <LevelPicker
        v-model="levelId"
        :count="count"
        :completion="completion"
        :best="best"
        :last-played="lastPlayed"
        :can-resume="canResume"
        @random="onRandom"
        @start="goPlay"
        @resume="goPlay"
      />
    </div>
    <div v-else-if="status === 'missing'" class="pt-card text-center" data-state="missing">
      <img
        class="pt-missing-img"
        src="/illustrations/missing.webp"
        width="1000"
        height="1000"
        :alt="t('home.missingAlt')"
        data-missing-img
      />
      <h2 class="h5 fw-bold mt-2 mb-1">{{ t('home.missingTitle') }}</h2>
      <p class="pt-muted mb-0">{{ t('home.missingBody') }}</p>
    </div>
    <div v-else-if="status === 'error'" class="pt-card pt-error" role="alert" data-state="error">
      {{ t('home.loadError') }}
    </div>
    <div v-else class="pt-muted" data-state="loading">{{ t('play.loading') }}</div>
  </section>
</template>

<style scoped>
.pt-home {
  max-width: 32rem;
}

.pt-hero-img {
  display: block;
  width: 100%;
  max-width: 22rem;
  height: auto;
  margin: 0 auto;
}

.pt-hero-title {
  font-size: 2rem;
  font-weight: 600;
  color: var(--pt-primary-strong);
}

.pt-muted {
  color: var(--pt-text-muted);
}

.pt-card {
  background: var(--pt-surface);
  border-radius: var(--pt-radius-card);
  box-shadow: var(--pt-shadow-clay);
  padding: 1rem;
}

.pt-rules-toggle {
  min-height: 44px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  text-align: start;
}

.pt-rules {
  padding-inline-start: 1.25rem;
}

.pt-rules li + li {
  margin-top: 0.25rem;
}

.pt-missing-img {
  display: block;
  width: 100%;
  max-width: 14rem;
  height: auto;
  margin: 0 auto;
}

.pt-error {
  color: var(--pt-danger);
}
</style>
