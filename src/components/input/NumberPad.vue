<script setup lang="ts">
import { t } from '../../i18n';

defineProps<{
  disabled: boolean;
  /** Digits typed so far (0–3 characters; three digits only for `100`). */
  pending: string;
}>();

const emit = defineEmits<{
  digit: [d: number];
  clear: [];
  confirm: [];
}>();

// Phone-style layout: 1-9 in rows, 0 on the bottom row between clear and confirm.
const DIGIT_ROWS = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
] as const;
</script>

<template>
  <div class="pt-number-pad" role="group" :aria-label="t('input.pad')">
    <output
      class="pt-number-pad__pending form-control text-center mb-2"
      data-pending
      aria-live="polite"
      :aria-label="t('input.pending', { value: pending })"
      >{{ pending }}</output
    >
    <div class="pt-number-pad__keys">
      <template v-for="row in DIGIT_ROWS" :key="row[0]">
        <button
          v-for="d in row"
          :key="d"
          type="button"
          class="btn btn-outline-secondary"
          :data-key="d"
          :disabled="disabled"
          :aria-label="t('input.digit', { n: d })"
          @click="emit('digit', d)"
        >
          {{ d }}
        </button>
      </template>
      <button type="button" class="btn btn-outline-secondary" data-key="clear" :disabled="disabled" @click="emit('clear')">
        {{ t('input.clear') }}
      </button>
      <button
        type="button"
        class="btn btn-outline-secondary"
        data-key="0"
        :disabled="disabled"
        :aria-label="t('input.digit', { n: 0 })"
        @click="emit('digit', 0)"
      >
        0
      </button>
      <button type="button" class="btn btn-primary" data-key="confirm" :disabled="disabled" @click="emit('confirm')">
        {{ t('input.confirm') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.pt-number-pad__pending {
  display: block;
  min-height: 2.5rem;
  font-variant-numeric: tabular-nums;
}

.pt-number-pad__keys {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.pt-number-pad__keys .btn {
  min-height: 2.75rem;
  font-variant-numeric: tabular-nums;
}
</style>
