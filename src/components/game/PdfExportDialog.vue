<script setup lang="ts">
import { ref, useId, watch } from 'vue';
import type { GameStatus } from '../../core/types';
import { useConfirm } from '../../composables/useConfirm';
import { t } from '../../i18n';
import BsModal from '../ui/BsModal.vue';

const props = defineProps<{
  modelValue: boolean;
  gameStatus: GameStatus;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  export: [options: { includeSolution: boolean }];
  markAssisted: [];
}>();

const { confirm } = useConfirm();
const checkboxId = `pt-pdf-solution-${useId()}`;
const includeSolution = ref(false);

// Each opening starts unchecked.
watch(
  () => props.modelValue,
  (open) => {
    if (open) includeSolution.value = false;
  },
);

async function onToggle(event: Event): Promise<void> {
  const checked = (event.target as HTMLInputElement).checked;
  includeSolution.value = checked;
  // Only a mid-game export with the solution affects records (spec §6.9).
  if (!checked || props.gameStatus !== 'playing') return;
  const ok = await confirm(t('pdf.confirmSolution'), {
    okLabel: t('common.confirm'),
    cancelLabel: t('common.cancel'),
  });
  if (ok) {
    emit('markAssisted');
  } else {
    includeSolution.value = false;
  }
}

function onExport(): void {
  emit('export', { includeSolution: includeSolution.value });
}
</script>

<template>
  <BsModal
    :model-value="modelValue"
    :title="t('pdf.title')"
    size="sm"
    :close-label="t('common.close')"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="form-check mb-0">
      <input
        :id="checkboxId"
        class="form-check-input"
        type="checkbox"
        data-include-solution
        :checked="includeSolution"
        @change="onToggle"
      />
      <label class="form-check-label" :for="checkboxId">{{ t('pdf.includeSolution') }}</label>
    </div>
    <template #footer>
      <button type="button" class="btn btn-secondary" data-action="cancel" @click="emit('update:modelValue', false)">
        {{ t('common.cancel') }}
      </button>
      <button type="button" class="btn btn-primary" data-action="export" @click="onExport">
        {{ t('pdf.export') }}
      </button>
    </template>
  </BsModal>
</template>
