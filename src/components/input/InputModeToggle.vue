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
  <div class="w-100 pt-mode-toggle" role="group" :aria-label="t('input.toggle')">
    <button
      v-for="mode in MODES"
      :key="mode"
      type="button"
      class="btn pt-mode-toggle__btn"
      :class="mode === modelValue ? 'btn-primary active' : 'btn-outline-primary'"
      :data-mode="mode"
      :aria-pressed="mode === modelValue ? 'true' : 'false'"
      @click="pick(mode)"
    >
      {{ t(`input.${mode}`) }}
    </button>
  </div>
</template>

<style scoped>
/* Bootstrap's button-group partial is not in the slimmed stylesheet, so a .btn-group would be a plain block
   and the buttons sat at their content width. Lay it out as a joined segmented control with two
   equal halves so it spans the row like the status bar and action bar around it (GAME-27). */
.pt-mode-toggle {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
}

.pt-mode-toggle__btn {
  min-height: 44px;
}

.pt-mode-toggle__btn:first-child {
  border-start-end-radius: 0;
  border-end-end-radius: 0;
}

.pt-mode-toggle__btn:last-child {
  border-start-start-radius: 0;
  border-end-start-radius: 0;
}
</style>
