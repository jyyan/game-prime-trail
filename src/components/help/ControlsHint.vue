<script setup lang="ts">
import { computed } from 'vue';
import type { InputMode } from '../../core/types';
import { t, type MessageKey } from '../../i18n';

/**
 * First-time controls hint (controls-help spec §4): one line for the player's device and the
 * current input mode. It sits in the page flow above the board and never takes focus.
 */
const props = defineProps<{ device: 'touch' | 'pointer'; mode: InputMode }>();
const emit = defineEmits<{ dismiss: [] }>();

/** `{token}` in a help string → the keys shown as <kbd> (see src/i18n/zh-TW/help.ts). */
const KEYS: Readonly<Record<string, readonly string[]>> = {
  arrows: ['↑', '↓', '←', '→'],
  backspace: ['Backspace'],
  del: ['Delete'],
  tab: ['Tab'],
  enter: ['Enter'],
};

const TEXT: Readonly<Record<'touch' | 'pointer', Record<InputMode, MessageKey>>> = {
  touch: { trail: 'help.hintTouchTrail', direct: 'help.hintTouchDirect' },
  pointer: { trail: 'help.hintPointerTrail', direct: 'help.hintPointerDirect' },
};

const parts = computed(() =>
  t(TEXT[props.device][props.mode])
    .split(/(\{\w+\})/)
    .filter((s) => s !== '')
    .map((s) => {
      const keys = /^\{(\w+)\}$/.exec(s)?.[1];
      return keys && KEYS[keys] ? { keys: KEYS[keys] } : { text: s };
    }),
);
</script>

<template>
  <div class="pt-hint" role="note" :aria-label="t('help.hintTitle')" data-controls-hint :data-device="device">
    <div class="pt-hint__body">
      <p class="pt-hint__title">{{ t('help.hintTitle') }}</p>
      <p class="pt-hint__text" data-hint-text>
        <template v-for="(part, i) in parts" :key="i">
          <template v-if="part.keys">
            <kbd v-for="k in part.keys" :key="k" class="pt-kbd">{{ k }}</kbd>
          </template>
          <template v-else>{{ part.text }}</template>
        </template>
      </p>
      <p class="pt-hint__more">{{ t('help.hintMore') }}</p>
    </div>
    <button
      type="button"
      class="btn-close pt-hint__close"
      data-action="dismissHint"
      :aria-label="t('help.hintDismiss')"
      @click="emit('dismiss')"
    />
  </div>
</template>

<style scoped>
.pt-hint {
  display: flex;
  align-items: flex-start;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
  padding: 0.5rem 0.25rem 0.5rem 0.875rem;
  color: var(--pt-text);
  background: var(--pt-surface);
  border-left: 6px solid var(--pt-primary);
  border-radius: var(--pt-radius-card);
  box-shadow: var(--pt-shadow-clay);
  animation: pt-hint-in 200ms ease-out;
}

.pt-hint__body {
  flex: 1 1 auto;
  min-width: 0;
  padding-top: 0.25rem;
}

.pt-hint__title {
  margin: 0 0 0.125rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--pt-primary-strong);
}

.pt-hint__text {
  margin: 0;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.pt-hint__more {
  margin: 0.125rem 0 0;
  font-size: 0.875rem;
  color: var(--pt-text-muted);
}

.pt-hint__close {
  flex: 0 0 auto;
  box-sizing: border-box;
  width: 44px;
  height: 44px;
  padding: 0;
  background-position: center;
}

.pt-kbd {
  display: inline-block;
  min-width: 1.6em;
  margin: 0 0.125rem;
  padding: 0 0.3em;
  font-family: var(--pt-font-num);
  font-size: 0.85em;
  line-height: 1.5;
  text-align: center;
  color: var(--pt-text);
  background: var(--pt-bg);
  border: 1px solid var(--pt-text-muted);
  border-bottom-width: 2px;
  border-radius: 6px;
}

@keyframes pt-hint-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pt-hint {
    animation: none;
  }
}
</style>
