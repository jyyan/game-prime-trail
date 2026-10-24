<script setup lang="ts">
import { computed } from 'vue';
import type { InputMode } from '../../core/types';
import { t } from '../../i18n';

const props = defineProps<{
  canUndo: boolean;
  /** Current input mode; the toggle button offers the other one (same as Tab on the board). */
  inputMode: InputMode;
}>();

const emit = defineEmits<{
  undo: [];
  clear: [];
  hint: [];
  restart: [];
  viewSolution: [];
  exportPdf: [];
  'update:inputMode': [mode: InputMode];
}>();

const otherMode = computed<InputMode>(() => (props.inputMode === 'trail' ? 'direct' : 'trail'));
</script>

<template>
  <div class="pt-play-actions d-flex flex-wrap gap-2" role="toolbar" :aria-label="t('play.actions')" :data-mode="inputMode">
    <button type="button" class="btn btn-outline-secondary" data-action="undo" :disabled="!canUndo" @click="emit('undo')">
      {{ t('play.undo') }}
    </button>
    <button
      type="button"
      class="btn btn-outline-secondary"
      data-action="toggleMode"
      :data-target-mode="otherMode"
      @click="emit('update:inputMode', otherMode)"
    >
      {{ t('play.switchMode', { mode: t(`input.${otherMode}`) }) }}
    </button>
    <button type="button" class="btn btn-outline-secondary" data-action="clear" @click="emit('clear')">
      {{ t('play.clear') }}
    </button>
    <button type="button" class="btn btn-outline-secondary" data-action="hint" @click="emit('hint')">
      {{ t('play.hint') }}
    </button>
    <button type="button" class="btn btn-outline-secondary" data-action="viewSolution" @click="emit('viewSolution')">
      {{ t('play.viewSolution') }}
    </button>
    <button type="button" class="btn btn-outline-secondary" data-action="exportPdf" @click="emit('exportPdf')">
      {{ t('play.exportPdf') }}
    </button>
    <button type="button" class="btn btn-outline-danger ms-auto" data-action="restart" @click="emit('restart')">
      {{ t('play.restart') }}
    </button>
  </div>
</template>
