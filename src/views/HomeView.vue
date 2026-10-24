<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import LevelPicker from '../components/picker/LevelPicker.vue';
import { useLevelStore } from '../composables/useLevelStore';
import { useProgress } from '../composables/useProgress';
import { useRecords } from '../composables/useRecords';
import type { Completion, Difficulty, LastPlayed, RecordEntry } from '../core/types';
import { t } from '../i18n';

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
    <h1 class="h3 mb-1">{{ t('home.title') }}</h1>
    <p class="text-body-secondary mb-4">{{ t('home.subtitle') }}</p>

    <LevelPicker
      v-if="status === 'ready'"
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
    <div v-else-if="status === 'missing'" class="alert alert-warning" data-state="missing">
      {{ t('play.levelMissing') }}
    </div>
    <div v-else-if="status === 'error'" class="alert alert-danger" data-state="error">
      {{ t('home.loadError') }}
    </div>
    <div v-else class="text-body-secondary" data-state="loading">{{ t('play.loading') }}</div>
  </section>
</template>

<style scoped>
.pt-home {
  max-width: 32rem;
}
</style>
