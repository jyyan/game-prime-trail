<script setup lang="ts">
import { computed, useId } from 'vue';
import { useConfirm } from '../../composables/useConfirm';
import BsModal from './BsModal.vue';

const { pending } = useConfirm();
const messageId = `pt-confirm-message-${useId()}`;

// Without a title the message itself names the dialog.
const labelledBy = computed(() => (pending.value?.title ? undefined : messageId));

function answer(ok: boolean): void {
  pending.value?.settle(ok);
}
</script>

<template>
  <BsModal
    :model-value="pending !== null"
    :title="pending?.title ?? ''"
    :labelled-by="labelledBy"
    size="sm"
    @update:model-value="answer(false)"
  >
    <p :id="messageId" class="mb-0">{{ pending?.message }}</p>
    <template #footer>
      <button type="button" class="btn btn-secondary" data-confirm="cancel" autofocus @click="answer(false)">
        {{ pending?.cancelLabel ?? 'Cancel' }}
      </button>
      <button type="button" class="btn btn-primary" data-confirm="ok" @click="answer(true)">
        {{ pending?.okLabel ?? 'OK' }}
      </button>
    </template>
  </BsModal>
</template>
