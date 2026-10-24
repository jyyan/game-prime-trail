<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { t } from '../../i18n';

/**
 * Action bar under the board (UI refresh spec §4.2): undo and hint stay out; the rarer actions
 * sit in a small "more" menu. Mode switching lives only in InputModeToggle, and the old "clear"
 * button is gone (it duplicated undo in trail mode and the number pad's clear in direct mode).
 */
defineProps<{
  canUndo: boolean;
}>();

const emit = defineEmits<{
  undo: [];
  hint: [];
  restart: [];
  viewSolution: [];
  exportPdf: [];
}>();

type MenuAction = 'viewSolution' | 'exportPdf' | 'restart';

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const menu = ref<HTMLElement | null>(null);

function items(): HTMLElement[] {
  return Array.from(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
}

async function openMenu(): Promise<void> {
  open.value = true;
  await nextTick();
  items()[0]?.focus();
}

function closeMenu(restoreFocus: boolean): void {
  if (!open.value) return;
  open.value = false;
  if (restoreFocus) trigger.value?.focus();
}

function toggle(): void {
  if (open.value) closeMenu(true);
  else void openMenu();
}

function choose(action: MenuAction): void {
  // Focus goes back to the trigger first, so a dialog the action opens returns focus there.
  closeMenu(true);
  if (action === 'viewSolution') emit('viewSolution');
  else if (action === 'exportPdf') emit('exportPdf');
  else emit('restart');
}

function onMenuKeydown(e: KeyboardEvent): void {
  const list = items();
  const at = list.indexOf(document.activeElement as HTMLElement);
  if (e.key === 'Escape') {
    e.preventDefault();
    closeMenu(true);
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const step = e.key === 'ArrowDown' ? 1 : -1;
    list[(at + step + list.length) % list.length]?.focus();
  } else if (e.key === 'Home' || e.key === 'End') {
    e.preventDefault();
    list[e.key === 'Home' ? 0 : list.length - 1]?.focus();
  } else if (e.key === 'Tab') {
    // Leaving the menu by Tab closes it; focus moves on as usual.
    closeMenu(false);
  }
}

function onTriggerKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && open.value) {
    e.preventDefault();
    closeMenu(true);
  } else if (e.key === 'ArrowDown' && !open.value) {
    e.preventDefault();
    void openMenu();
  }
}

function onDocumentPointerDown(e: PointerEvent): void {
  const el = root.value;
  if (el && e.target instanceof Node && el.contains(e.target)) return;
  closeMenu(false);
}

watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('pointerdown', onDocumentPointerDown, true);
  else document.removeEventListener('pointerdown', onDocumentPointerDown, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true);
});
</script>

<template>
  <div ref="root" class="pt-play-actions" role="toolbar" :aria-label="t('play.actions')">
    <button type="button" class="btn btn-outline-secondary" data-action="undo" :disabled="!canUndo" @click="emit('undo')">
      {{ t('play.undo') }}
    </button>
    <button type="button" class="btn btn-outline-secondary" data-action="hint" @click="emit('hint')">
      {{ t('play.hint') }}
    </button>
    <div class="pt-play-actions__more">
      <button
        ref="trigger"
        type="button"
        class="btn btn-outline-secondary w-100"
        data-action="more"
        aria-haspopup="menu"
        :aria-expanded="open ? 'true' : 'false'"
        aria-controls="pt-play-more-menu"
        @click="toggle"
        @keydown="onTriggerKeydown"
      >
        {{ t('play.more') }}
        <span class="pt-play-actions__caret" aria-hidden="true">▾</span>
      </button>
      <div
        v-if="open"
        id="pt-play-more-menu"
        ref="menu"
        class="pt-play-actions__menu"
        role="menu"
        :aria-label="t('play.moreMenu')"
        data-menu="more"
        @keydown="onMenuKeydown"
      >
        <button type="button" role="menuitem" class="pt-play-actions__item" data-action="viewSolution" @click="choose('viewSolution')">
          {{ t('play.viewSolution') }}
        </button>
        <button type="button" role="menuitem" class="pt-play-actions__item" data-action="exportPdf" @click="choose('exportPdf')">
          {{ t('play.exportPdf') }}
        </button>
        <hr class="pt-play-actions__sep" role="separator" />
        <button
          type="button"
          role="menuitem"
          class="pt-play-actions__item pt-play-actions__item--danger"
          data-action="restart"
          @click="choose('restart')"
        >
          {{ t('play.restart') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pt-play-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.pt-play-actions .btn {
  min-height: 44px;
}

.pt-play-actions__more {
  position: relative;
}

.pt-play-actions__caret {
  display: inline-block;
  margin-inline-start: 0.125rem;
}

.pt-play-actions__menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 0.5rem);
  z-index: 1000;
  min-width: 11rem;
  padding: 0.375rem;
  border-radius: var(--pt-radius-btn);
  background-color: var(--pt-surface);
  box-shadow: var(--pt-shadow-clay);
  animation: pt-menu-in var(--pt-dur) ease-out;
}

.pt-play-actions__item {
  display: block;
  width: 100%;
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  border: 0;
  border-radius: calc(var(--pt-radius-btn) - 4px);
  background: transparent;
  color: var(--pt-text);
  text-align: start;
}

.pt-play-actions__item:hover,
.pt-play-actions__item:focus-visible {
  background-color: var(--pt-bg);
}

.pt-play-actions__item:focus-visible {
  outline: 3px solid var(--pt-primary);
  outline-offset: -3px;
}

.pt-play-actions__item--danger {
  color: var(--pt-danger);
}

.pt-play-actions__sep {
  margin: 0.25rem 0.5rem;
  border-color: var(--pt-text-muted);
}

@keyframes pt-menu-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pt-play-actions__menu {
    animation: none;
  }
}
</style>
