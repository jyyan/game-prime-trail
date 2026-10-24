<script setup lang="ts">
import type { InputMode } from '../../core/types';
import { t } from '../../i18n';

const props = defineProps<{ modelValue: InputMode }>();

const emit = defineEmits<{ 'update:modelValue': [mode: InputMode] }>();

const MODES: readonly InputMode[] = ['trail', 'direct'];

function pick(mode: InputMode): void {
  if (mode !== props.modelValue) emit('update:modelValue', mode);
}
</script>

<template>
  <div class="btn-group w-100" role="group" :aria-label="t('input.toggle')">
    <button
      v-for="mode in MODES"
      :key="mode"
      type="button"
      class="btn"
      :class="mode === modelValue ? 'btn-primary active' : 'btn-outline-primary'"
      :data-mode="mode"
      :aria-pressed="mode === modelValue ? 'true' : 'false'"
      @click="pick(mode)"
    >
      {{ t(`input.${mode}`) }}
    </button>
  </div>
</template>
