<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { DIFFICULTIES, type Completion, type Difficulty, type LastPlayed, type RecordEntry } from '../../core/types';
import { t } from '../../i18n';
import { padId } from '../format';
import DifficultyPicker from './DifficultyPicker.vue';

const props = defineProps<{
  /** Level id typed by the player; `null` while the field is empty. */
  modelValue: number | null;
  count: number;
  completion: (id: number, d: Difficulty) => Completion;
  best: (id: number, d: Difficulty) => RecordEntry | null;
  lastPlayed: LastPlayed | null;
  canResume: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [id: number | null];
  start: [levelId: number, difficulty: Difficulty];
  resume: [levelId: number, difficulty: Difficulty];
  random: [];
}>();

const difficulty = ref<Difficulty>('easy');
const inputId = `pt-level-id-${useId()}`;
const errorId = `${inputId}-error`;

const validId = computed<number | null>(() => {
  const id = props.modelValue;
  return id !== null && Number.isInteger(id) && id >= 1 && id <= props.count ? id : null;
});

// Set on blur or a start attempt, cleared while typing: the message waits until the player is
// done with the field instead of flashing on every keystroke.
const touched = ref(false);

// An empty field only disables "start"; the message is for a value outside 1…count
// (UI refresh spec §4.4, backlog R30).
const showInvalid = computed(() => touched.value && props.modelValue !== null && validId.value === null);

function perDifficulty<T>(pick: (id: number, d: Difficulty) => T, fallback: T): Record<Difficulty, T> {
  const id = validId.value;
  return Object.fromEntries(DIFFICULTIES.map((d) => [d, id === null ? fallback : pick(id, d)])) as Record<
    Difficulty,
    T
  >;
}

const completionByDifficulty = computed(() => perDifficulty<Completion>(props.completion, 'none'));
const bestByDifficulty = computed(() => perDifficulty<RecordEntry | null>(props.best, null));

const resumeLabel = computed(() =>
  props.lastPlayed
    ? t('picker.resumeLabel', {
        id: padId(props.lastPlayed.levelId),
        difficulty: t(`difficulty.${props.lastPlayed.difficulty}`),
      })
    : '',
);

function onInput(event: Event): void {
  const raw = (event.target as HTMLInputElement).value.trim();
  const id = raw === '' ? Number.NaN : Number(raw);
  touched.value = false;
  emit('update:modelValue', Number.isFinite(id) ? id : null);
}

function onBlur(): void {
  touched.value = true;
}

function start(): void {
  touched.value = true;
  if (validId.value !== null) emit('start', validId.value, difficulty.value);
}

function resume(): void {
  if (props.lastPlayed) emit('resume', props.lastPlayed.levelId, props.lastPlayed.difficulty);
}
</script>

<template>
  <div class="pt-level-picker">
    <button
      v-if="canResume && lastPlayed"
      type="button"
      class="btn btn-success pt-control w-100 mb-3 d-flex justify-content-between align-items-center"
      data-action="resume"
      @click="resume"
    >
      <span>{{ t('picker.resume') }}</span>
      <span class="pt-num">{{ resumeLabel }}</span>
    </button>

    <label :for="inputId" class="form-label fw-semibold">{{ t('picker.levelId') }}</label>
    <div class="d-flex gap-2 mb-1">
      <input
        :id="inputId"
        type="number"
        inputmode="numeric"
        class="form-control pt-control pt-num"
        :class="{ 'is-invalid': showInvalid }"
        min="1"
        :max="count"
        step="1"
        data-level-id
        :value="modelValue ?? ''"
        :aria-invalid="showInvalid ? 'true' : 'false'"
        :aria-describedby="showInvalid ? errorId : undefined"
        @input="onInput"
        @blur="onBlur"
        @keydown.enter="start"
      />
      <button
        type="button"
        class="btn btn-outline-secondary pt-control d-inline-flex align-items-center gap-1 flex-shrink-0"
        data-action="random"
        @click="emit('random')"
      >
        <svg
          class="pt-dice"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          aria-hidden="true"
          focusable="false"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="16" cy="8" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="8" cy="16" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="16" cy="16" r="1.4" fill="currentColor" stroke="none" />
        </svg>
        <span>{{ t('picker.random') }}</span>
      </button>
    </div>
    <div v-if="showInvalid" :id="errorId" class="text-danger small mb-2" role="alert" data-invalid-id>
      {{ t('picker.invalidId', { max: count }) }}
    </div>

    <DifficultyPicker
      v-model="difficulty"
      class="my-3"
      :completion="completionByDifficulty"
      :best="bestByDifficulty"
    />

    <button
      type="button"
      class="btn btn-primary btn-lg pt-control w-100"
      data-action="start"
      :disabled="validId === null"
      @click="start"
    >
      {{ t('picker.start') }}
    </button>
  </div>
</template>

<style scoped>
.pt-control {
  min-height: 44px;
}

.pt-dice {
  flex-shrink: 0;
}
</style>
