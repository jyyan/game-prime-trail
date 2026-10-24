<script lang="ts">
// Open modals in opening order, top-most last. Shared across instances so that
// only the top modal reacts to Esc, stacks visually above the others regardless
// of DOM (mount) order, and `modal-open` stays on <body> while any is open.
const openStack: { token: symbol; layer: number }[] = [];

// Bootstrap's --bs-backdrop-zindex / --bs-modal-zindex; each layer adds a step.
const BACKDROP_Z = 1050;
const MODAL_Z = 1055;
const LAYER_STEP = 10;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    size?: 'sm' | 'lg';
    closeOnBackdrop?: boolean;
    labelledBy?: string;
    closeLabel?: string;
  }>(),
  { closeOnBackdrop: true, closeLabel: 'Close' },
);

const emit = defineEmits<{
  'update:modelValue': [value: false];
  closed: [];
}>();

const token = Symbol('modal');
const titleId = `pt-modal-title-${useId()}`;
const dialogEl = ref<HTMLElement | null>(null);
const layer = ref(0);
let returnFocusTo: HTMLElement | null = null;
let isOpen = false;

const ariaLabelledBy = computed(() => props.labelledBy ?? (props.title ? titleId : undefined));
const dialogClass = computed(() => (props.size ? `modal-${props.size}` : undefined));
const modalStyle = computed(() => ({ zIndex: MODAL_Z + layer.value * LAYER_STEP }));
const backdropStyle = computed(() => ({ zIndex: BACKDROP_Z + layer.value * LAYER_STEP }));

function isTop(): boolean {
  return openStack[openStack.length - 1]?.token === token;
}

function requestClose(): void {
  emit('update:modelValue', false);
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !isTop()) return;
  event.preventDefault();
  requestClose();
}

function onBackdrop(event: MouseEvent): void {
  // Only clicks on the backdrop area itself, not bubbling from the dialog.
  if (event.target !== event.currentTarget) return;
  if (props.closeOnBackdrop) requestClose();
}

function syncBodyClass(): void {
  document.body.classList.toggle('modal-open', openStack.length > 0);
}

async function open(): Promise<void> {
  if (isOpen) return;
  isOpen = true;
  const active = document.activeElement;
  returnFocusTo = active instanceof HTMLElement && active !== document.body ? active : null;
  // One layer above whatever is currently on top, so a modal opened later always
  // covers earlier ones even if it was mounted (and teleported) before them.
  layer.value = (openStack[openStack.length - 1]?.layer ?? -1) + 1;
  openStack.push({ token, layer: layer.value });
  syncBodyClass();
  document.addEventListener('keydown', onKeydown);
  await nextTick();
  const root = dialogEl.value;
  if (!isOpen || !root) return;
  const target =
    root.querySelector<HTMLElement>('[autofocus]') ?? root.querySelector<HTMLElement>(FOCUSABLE);
  (target ?? root).focus();
}

function teardown(): boolean {
  if (!isOpen) return false;
  isOpen = false;
  const index = openStack.findIndex((entry) => entry.token === token);
  if (index !== -1) openStack.splice(index, 1);
  syncBodyClass();
  document.removeEventListener('keydown', onKeydown);
  const target = returnFocusTo;
  returnFocusTo = null;
  if (target?.isConnected) target.focus();
  return true;
}

watch(
  () => props.modelValue,
  (value) => {
    if (value) {
      void open();
    } else if (teardown()) {
      emit('closed');
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  teardown();
});
</script>

<template>
  <Teleport to="body">
    <template v-if="modelValue">
      <div
        class="modal show d-block"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="ariaLabelledBy"
        :style="modalStyle"
        @click="onBackdrop"
      >
        <div ref="dialogEl" class="modal-dialog modal-dialog-centered" :class="dialogClass" tabindex="-1">
          <div class="modal-content">
            <div class="modal-header">
              <h5 v-if="title" :id="titleId" class="modal-title">{{ title }}</h5>
              <button type="button" class="btn-close" :aria-label="closeLabel" @click="requestClose" />
            </div>
            <div class="modal-body">
              <slot />
            </div>
            <div v-if="$slots.footer" class="modal-footer">
              <slot name="footer" />
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop show" :style="backdropStyle" @click="onBackdrop" />
    </template>
  </Teleport>
</template>
