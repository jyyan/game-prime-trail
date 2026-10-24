<script setup lang="ts">
import { computed } from 'vue';
import type { Difficulty } from '../../core/types';
import { t } from '../../i18n';
import { formatMs, padId } from '../format';

const props = defineProps<{
  levelId: number;
  difficulty: Difficulty;
  elapsedMs: number;
  steps: number;
  assisted: boolean;
}>();

const SEPARATOR = '・';

const summary = computed(() =>
  [
    t('status.level', { id: padId(props.levelId) }),
    t(`difficulty.${props.difficulty}`),
    formatMs(props.elapsedMs),
    t('status.steps', { n: props.steps }),
  ].join(SEPARATOR),
);
</script>

<template>
  <div class="pt-status-bar d-flex flex-wrap align-items-center gap-2" role="status" :aria-label="t('status.label')">
    <span class="pt-status-bar__summary" data-summary>{{ summary }}</span>
    <span v-if="assisted" class="badge text-bg-warning" data-assisted>{{ t('status.assisted') }}</span>
  </div>
</template>

<style scoped>
.pt-status-bar__summary {
  font-variant-numeric: tabular-nums;
}
</style>
