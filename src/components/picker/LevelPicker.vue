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

// An empty field disables "start" quietly; only a typed but invalid id gets a message.
const showInvalid = computed(() => props.modelValue !== null && validId.value === null);

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
  emit('update:modelValue', raw === '' ? null : Number(raw));
}

function start(): void {
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
      class="btn btn-success w-100 mb-3 d-flex justify-content-between"
      data-action="resume"
      @click="resume"
    >
      <span>{{ t('picker.resume') }}</span>
      <span>{{ resumeLabel }}</span>
    </button>

    <label :for="inputId" class="form-label">{{ t('picker.levelId') }}</label>
    <div class="input-group mb-1">
      <input
        :id="inputId"
        type="number"
        inputmode="numeric"
        class="form-control"
        :class="{ 'is-invalid': showInvalid }"
        min="1"
        :max="count"
        step="1"
        data-level-id
        :value="modelValue ?? ''"
        :aria-invalid="showInvalid ? 'true' : 'false'"
        :aria-describedby="showInvalid ? errorId : undefined"
        @input="onInput"
        @keydown.enter="start"
      />
      <button type="button" class="btn btn-outline-secondary" data-action="random" @click="emit('random')">
        {{ t('picker.random') }}
      </button>
    </div>
    <div v-if="showInvalid" :id="errorId" class="text-danger small mb-2" data-invalid-id>
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
      class="btn btn-primary w-100"
      data-action="start"
      :disabled="validId === null"
      @click="start"
    >
      {{ t('picker.start') }}
    </button>
  </div>
</template>
