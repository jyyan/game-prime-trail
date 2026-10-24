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
    <!-- Name and one-line hint on the left; completion mark and best record on the right (UI refresh §5.2). -->
    <button
      v-for="d in DIFFICULTIES"
      :key="d"
      type="button"
      class="btn pt-difficulty d-flex justify-content-between align-items-center gap-3 text-start"
      :class="d === modelValue ? 'btn-primary' : 'btn-outline-primary'"
      :data-difficulty="d"
      :aria-pressed="d === modelValue ? 'true' : 'false'"
      @click="emit('update:modelValue', d)"
    >
      <span class="d-flex flex-column">
        <span class="pt-difficulty-name">{{ t(`difficulty.${d}`) }}</span>
        <small class="pt-difficulty-hint" data-difficulty-hint>{{ t(`picker.difficultyHint.${d}`) }}</small>
      </span>
      <span class="d-flex flex-column align-items-end text-end">
        <span class="pt-completion" :data-completion="completion[d]">
          <template v-if="completion[d] === 'cleared'">
            <span aria-hidden="true">{{ MARK.cleared }}</span>
            <span class="visually-hidden">{{ t('picker.cleared') }}</span>
          </template>
          <template v-else-if="completion[d] === 'assisted'">
            <span aria-hidden="true">{{ MARK.assisted }}</span>
            <small class="ms-1">{{ t('picker.assistedCleared') }}</small>
          </template>
        </span>
        <small class="pt-best pt-num" data-best>
          <template v-if="bestParts(best[d]).length > 0">{{ bestParts(best[d]).join(' / ') }}</template>
        </small>
      </span>
    </button>
  </div>
</template>

<style scoped>
.pt-difficulty {
  min-height: 3.5rem;
  border-radius: var(--pt-radius-btn);
}

.pt-difficulty-name {
  font-weight: 600;
}

.pt-best {
  font-variant-numeric: tabular-nums;
}
</style>
