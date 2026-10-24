<script setup lang="ts">
import { useToast, type ToastVariant } from '../../composables/useToast';

withDefaults(defineProps<{ closeLabel?: string }>(), { closeLabel: 'Close' });

const { toasts, dismiss } = useToast();

const VARIANT_CLASS: Record<ToastVariant, string> = {
  info: '',
  success: 'bg-success text-white',
  danger: 'bg-danger text-white',
};
</script>

<template>
  <div class="toast-container position-fixed bottom-0 end-0 p-3">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast show"
      :class="VARIANT_CLASS[toast.variant]"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div class="d-flex">
        <div class="toast-body">{{ toast.message }}</div>
        <button
          type="button"
          class="btn-close me-2 m-auto"
          :class="{ 'btn-close-white': toast.variant !== 'info' }"
          :aria-label="closeLabel"
          @click="dismiss(toast.id)"
        />
      </div>
    </div>
  </div>
</template>
