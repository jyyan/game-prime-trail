<script setup lang="ts">
import { computed } from 'vue';
import type { Difficulty } from '../../core/types';
import { t } from '../../i18n';
import BsModal from '../ui/BsModal.vue';
import { formatMs, padId } from '../format';

const props = defineProps<{
  modelValue: boolean;
  levelId: number;
  difficulty: Difficulty;
  elapsedMs: number;
  steps: number;
  best: { bestMs: number | null; bestSteps: number | null } | null;
  isNewBest: { time: boolean; steps: boolean };
  assisted: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  viewSolution: [];
  nextRandom: [];
  backHome: [];
  exportPdf: [];
}>();

const title = computed(() => (props.assisted ? t('win.titleAssisted') : t('win.title')));

const bestParts = computed(() => {
  const best = props.best;
  if (!best) return [];
  const parts: string[] = [];
  if (best.bestMs !== null) parts.push(t('win.bestTime', { time: formatMs(best.bestMs) }));
  if (best.bestSteps !== null) parts.push(t('win.bestSteps', { n: best.bestSteps }));
  return parts;
});

// Assisted games never set records, so their badges are suppressed (spec §6.7).
const showTimeBadge = computed(() => !props.assisted && props.isNewBest.time);
const showStepsBadge = computed(() => !props.assisted && props.isNewBest.steps);
</script>

<template>
  <BsModal
    :model-value="modelValue"
    :title="title"
    :close-label="t('common.close')"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p class="mb-2">
      {{ t('status.level', { id: padId(levelId) }) }}・{{ t(`difficulty.${difficulty}`) }}
    </p>
    <ul class="list-unstyled mb-2 pt-win__result">
      <li data-time>
        {{ t('win.time', { time: formatMs(elapsedMs) }) }}
        <span v-if="showTimeBadge" class="badge text-bg-success ms-1" data-new-best="time">{{
          t('win.newBestTime')
        }}</span>
      </li>
      <li data-steps>
        {{ t('win.steps', { n: steps }) }}
        <span v-if="showStepsBadge" class="badge text-bg-success ms-1" data-new-best="steps">{{
          t('win.newBestSteps')
        }}</span>
      </li>
    </ul>
    <p v-if="bestParts.length > 0" class="text-body-secondary small mb-2" data-best>{{ bestParts.join(' / ') }}</p>
    <p v-if="assisted" class="text-body-secondary mb-0" data-not-recorded>{{ t('win.notRecorded') }}</p>
    <template #footer>
      <button type="button" class="btn btn-outline-secondary" data-action="viewSolution" @click="emit('viewSolution')">
        {{ t('win.viewSolution') }}
      </button>
      <button type="button" class="btn btn-outline-secondary" data-action="exportPdf" @click="emit('exportPdf')">
        {{ t('win.exportPdf') }}
      </button>
      <button type="button" class="btn btn-outline-secondary" data-action="backHome" @click="emit('backHome')">
        {{ t('win.backHome') }}
      </button>
      <button type="button" class="btn btn-primary" data-action="nextRandom" autofocus @click="emit('nextRandom')">
        {{ t('win.nextRandom') }}
      </button>
    </template>
  </BsModal>
</template>

<style scoped>
.pt-win__result {
  font-variant-numeric: tabular-nums;
}
</style>
