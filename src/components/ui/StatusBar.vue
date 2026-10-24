<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import type { InputMode } from '../../core/types';
import { t } from '../../i18n';

/** How long the pending box stays red after a rejected digit (spec §3: micro-interactions 150–300ms). */
const REJECT_FLASH_MS = 300;

const props = defineProps<{
  steps: number;
  assisted: boolean;
  mode: InputMode;
  /** Trail mode: the number the next cell gets (head + 1), or null once 100 is placed. */
  next: number | null;
  /** Direct mode: the digits typed so far (0–3 characters). */
  pending: string;
  /** Bumped by the view whenever a digit is refused (it would leave 1–100); flashes the pending box. */
  rejectSeq?: number;
}>();

const rejected = ref(false);
let rejectTimer: ReturnType<typeof setTimeout> | null = null;

function clearRejectTimer(): void {
  if (rejectTimer !== null) clearTimeout(rejectTimer);
  rejectTimer = null;
}

watch(
  () => props.rejectSeq,
  (seq, prev) => {
    if (seq === undefined || seq === prev) return;
    clearRejectTimer();
    rejected.value = true;
    rejectTimer = setTimeout(() => {
      rejected.value = false;
      rejectTimer = null;
    }, REJECT_FLASH_MS);
  },
);

watch(
  () => props.mode,
  () => {
    clearRejectTimer();
    rejected.value = false;
  },
);

onBeforeUnmount(clearRejectTimer);
</script>

<template>
  <div
    class="pt-status-bar d-flex flex-wrap align-items-center gap-2"
    role="status"
    :aria-label="t('status.label')"
    :data-mode="mode"
  >
    <span v-if="mode === 'trail' && next !== null" class="pt-status-bar__lead" data-next>
      <span class="pt-status-bar__label">{{ t('status.next') }}</span>
      <span class="pt-status-bar__value pt-num" data-next-value>{{ next }}</span>
    </span>
    <span
      v-else-if="mode === 'direct'"
      class="pt-status-bar__lead"
      :class="{ 'is-rejected': rejected }"
      data-pending-box
      :data-rejected="rejected ? 'true' : null"
    >
      <span class="pt-status-bar__label">{{ t('status.pending') }}</span>
      <output class="pt-status-bar__value pt-status-bar__pending pt-num" data-pending>{{ pending }}</output>
      <span v-if="rejected" class="visually-hidden" data-pending-rejected>{{ t('status.pendingRejected') }}</span>
    </span>
    <span class="pt-status-bar__steps ms-auto" data-steps>{{ t('status.steps', { n: steps }) }}</span>
    <span v-if="assisted" class="badge text-bg-warning" data-assisted>{{ t('status.assisted') }}</span>
  </div>
</template>

<style scoped>
.pt-status-bar {
  min-height: 3rem;
  padding: 0.25rem 0.75rem;
  border-radius: var(--pt-radius-btn);
  background-color: var(--pt-surface);
  box-shadow: var(--pt-shadow-clay);
}

.pt-status-bar__lead {
  display: inline-flex;
  align-items: baseline;
  gap: 0.25rem;
  border: 2px solid transparent;
  border-radius: var(--pt-radius-btn);
  padding: 0 0.375rem;
  transition: border-color var(--pt-dur) ease-out;
}

.pt-status-bar__label {
  color: var(--pt-text-muted);
}

.pt-status-bar__value {
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.2;
  color: var(--pt-primary-strong);
}

.pt-status-bar__pending {
  display: inline-block;
  min-width: 3ch;
  border-bottom: 2px dashed var(--pt-text-muted);
  text-align: center;
}

.pt-status-bar__lead.is-rejected {
  border-color: var(--pt-danger);
  animation: pt-status-reject 150ms ease-out;
}

.pt-status-bar__lead.is-rejected .pt-status-bar__pending {
  color: var(--pt-danger);
}

.pt-status-bar__steps {
  font-variant-numeric: tabular-nums;
}

@keyframes pt-status-reject {
  25% {
    transform: translateX(-3px);
  }
  75% {
    transform: translateX(3px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pt-status-bar__lead {
    transition: none;
  }

  .pt-status-bar__lead.is-rejected {
    animation: none;
  }
}
</style>
