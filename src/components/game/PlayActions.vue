<script setup lang="ts">
import type { InputMode } from '../../core/types';
import { t } from '../../i18n';

defineProps<{
  canUndo: boolean;
  /** Current input mode; carried as `data-mode` so styles and tests can tell the clear semantics apart. */
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
</script>

<template>
  <div class="pt-play-actions d-flex flex-wrap gap-2" role="toolbar" :aria-label="t('play.actions')" :data-mode="inputMode">
    <button type="button" class="btn btn-outline-secondary" data-action="undo" :disabled="!canUndo" @click="emit('undo')">
      {{ t('play.undo') }}
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
