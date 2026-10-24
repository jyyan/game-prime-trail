<script setup lang="ts">
import { ref, useId, watch } from 'vue';
import type { GameStatus } from '../../core/types';
import { useConfirm } from '../../composables/useConfirm';
import { t } from '../../i18n';
import BsModal from '../ui/BsModal.vue';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    gameStatus: GameStatus;
    /** The game already counts as assisted, so adding the solution page needs no confirmation. */
    assisted?: boolean;
  }>(),
  { assisted: false },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  export: [options: { includeSolution: boolean }];
  markAssisted: [];
}>();

const { confirm } = useConfirm();
const checkboxId = `pt-pdf-solution-${useId()}`;
const includeSolution = ref(false);
const confirming = ref(false);
// Bumped on every open so a confirmation answered after the dialog reopened is ignored.
let session = 0;

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    session++;
    includeSolution.value = false;
    confirming.value = false;
  },
  { immediate: true },
);

async function onToggle(event: Event): Promise<void> {
  const checked = (event.target as HTMLInputElement).checked;
  includeSolution.value = checked;
  // Only a mid-game export with the solution affects records (spec §6.9).
  if (!checked || props.gameStatus !== 'playing' || props.assisted) return;
  const mine = session;
  confirming.value = true;
  const ok = await confirm(t('pdf.confirmSolution'), {
    okLabel: t('common.confirm'),
    cancelLabel: t('common.cancel'),
  });
  if (mine !== session) return;
  confirming.value = false;
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
        :disabled="confirming"
        @change="onToggle"
      />
      <label class="form-check-label" :for="checkboxId">{{ t('pdf.includeSolution') }}</label>
    </div>
    <template #footer>
      <button type="button" class="btn btn-secondary" data-action="cancel" @click="emit('update:modelValue', false)">
        {{ t('common.cancel') }}
      </button>
      <button type="button" class="btn btn-primary" data-action="export" :disabled="confirming" @click="onExport">
        {{ t('pdf.export') }}
      </button>
    </template>
  </BsModal>
</template>
