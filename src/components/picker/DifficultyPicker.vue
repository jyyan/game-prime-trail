<script setup lang="ts">
import { DIFFICULTIES, type Completion, type Difficulty, type RecordEntry } from '../../core/types';
import { t } from '../../i18n';
import { formatMs } from '../format';

defineProps<{
  modelValue: Difficulty;
  completion: Record<Difficulty, Completion>;
  best: Record<Difficulty, RecordEntry | null>;
}>();

const emit = defineEmits<{ 'update:modelValue': [difficulty: Difficulty] }>();

// Filled check = normal clear, hollow check = assisted-only clear (spec §6.6).
const MARK: Record<Completion, string> = { cleared: '✔', assisted: '✓', none: '' };

function bestParts(entry: RecordEntry | null): string[] {
  if (!entry) return [];
  const parts: string[] = [];
  if (entry.bestMs !== null) parts.push(t('picker.bestTime', { time: formatMs(entry.bestMs) }));
  if (entry.bestSteps !== null) parts.push(t('picker.bestSteps', { n: entry.bestSteps }));
  return parts;
}
</script>

<template>
  <div class="pt-difficulty-picker d-grid gap-2" role="group" :aria-label="t('picker.difficulty')">
    <button
      v-for="d in DIFFICULTIES"
      :key="d"
      type="button"
      class="btn d-flex justify-content-between align-items-center text-start"
      :class="d === modelValue ? 'btn-primary' : 'btn-outline-primary'"
      :data-difficulty="d"
      :aria-pressed="d === modelValue ? 'true' : 'false'"
      @click="emit('update:modelValue', d)"
    >
      <span>
        <span class="pt-completion me-1" :data-completion="completion[d]">
          <template v-if="completion[d] === 'cleared'">
            <span aria-hidden="true">{{ MARK.cleared }}</span>
            <span class="visually-hidden">{{ t('picker.cleared') }}</span>
          </template>
          <template v-else-if="completion[d] === 'assisted'">
            <span aria-hidden="true">{{ MARK.assisted }}</span>
            <small class="ms-1">{{ t('picker.assistedCleared') }}</small>
          </template>
        </span>
        {{ t(`difficulty.${d}`) }}
      </span>
      <small class="pt-best" data-best>
        <template v-if="bestParts(best[d]).length > 0">{{ bestParts(best[d]).join(' / ') }}</template>
      </small>
    </button>
  </div>
</template>

<style scoped>
.pt-completion {
  display: inline-block;
  min-width: 1em;
}

.pt-best {
  font-variant-numeric: tabular-nums;
}
</style>
