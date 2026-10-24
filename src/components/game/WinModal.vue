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

// Served from public/ (UI refresh spec §5.4); BASE_URL keeps it working under a sub-path deploy.
const illustrationSrc = `${import.meta.env.BASE_URL}illustrations/win.webp`;

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
    <img
      class="pt-win__art d-block mx-auto mb-2"
      :src="illustrationSrc"
      width="140"
      height="140"
      :alt="t('win.illustrationAlt')"
      data-win-art
    />
    <p class="text-center mb-3">
      {{ t('status.level', { id: padId(levelId) }) }}・{{ t(`difficulty.${difficulty}`) }}
    </p>
    <ul class="list-unstyled pt-win__result">
      <!-- Label and value stay on one line so the text reads "<label> <value>" with one space;
           Vue drops whitespace between elements only when it spans a line break. -->
      <li class="pt-win__stat" data-time>
        <span class="pt-win__label">{{ t('win.timeLabel') }}</span> <span class="pt-win__value pt-num">{{ formatMs(elapsedMs) }}</span>
        <span v-if="showTimeBadge" class="badge pt-win__badge" data-new-best="time">{{ t('win.newBestTime') }}</span>
      </li>
      <li class="pt-win__stat" data-steps>
        <span class="pt-win__label">{{ t('win.stepsLabel') }}</span> <span class="pt-win__value pt-num">{{ steps }}</span>
        <span v-if="showStepsBadge" class="badge pt-win__badge" data-new-best="steps">{{ t('win.newBestSteps') }}</span>
      </li>
    </ul>
    <p v-if="bestParts.length > 0" class="text-body-secondary small text-center mb-2" data-best>
      {{ bestParts.join(' / ') }}
    </p>
    <p v-if="assisted" class="text-body-secondary text-center mb-0" data-not-recorded>{{ t('win.notRecorded') }}</p>
    <template #footer>
      <div class="pt-win__actions">
        <button
          type="button"
          class="btn btn-primary btn-lg pt-win__next"
          data-action="nextRandom"
          autofocus
          @click="emit('nextRandom')"
        >
          {{ t('win.nextRandom') }}
        </button>
        <button type="button" class="btn btn-outline-secondary" data-action="viewSolution" @click="emit('viewSolution')">
          {{ t('win.viewSolution') }}
        </button>
        <button type="button" class="btn btn-outline-secondary" data-action="exportPdf" @click="emit('exportPdf')">
          {{ t('win.exportPdf') }}
        </button>
        <button type="button" class="btn btn-outline-secondary" data-action="backHome" @click="emit('backHome')">
          {{ t('win.backHome') }}
        </button>
      </div>
    </template>
  </BsModal>
</template>

<style scoped>
.pt-win__art {
  width: 140px;
  height: 140px;
  object-fit: contain;
  animation: pt-win-pop 300ms ease-out both;
}

@keyframes pt-win-pop {
  0% {
    opacity: 0;
    transform: scale(0.6);
  }
  70% {
    opacity: 1;
    transform: scale(1.06);
  }
  100% {
    transform: scale(1);
  }
}

.pt-win__result {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.pt-win__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 0.5rem;
  border-radius: var(--pt-radius-btn);
  /* The dialog itself paints --pt-bg (Bootstrap's modal bg follows $body-bg), so the tiles are surface. */
  background-color: var(--pt-surface);
  box-shadow: var(--pt-shadow-clay);
  text-align: center;
}

.pt-win__label {
  color: var(--pt-text-muted);
  font-size: 0.875rem;
}

.pt-win__value {
  color: var(--pt-text);
  font-size: 2.25rem;
  font-weight: 600;
  line-height: 1.1;
}

/*
 * White on --pt-pink is only 3.53:1, so the badge stays WCAG "large text": ≥ 18.66px (14pt) bold
 * (scripts/check-contrast.ts checks this pair as large text).
 */
.pt-win__badge {
  background-color: var(--pt-pink);
  color: var(--pt-surface);
  font-size: 1.1875rem;
  font-weight: 700;
  line-height: 1.2;
  padding: 0.3em 0.6em;
  border-radius: 999px;
  white-space: normal;
}

.pt-win__actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  width: 100%;
  margin: 0;
}

.pt-win__actions .btn {
  min-height: 44px;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}

.pt-win__next {
  grid-column: 1 / -1;
}

@media (prefers-reduced-motion: reduce) {
  .pt-win__art {
    animation: none;
  }
}
</style>
