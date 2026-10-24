<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import type { Cell, ConflictKind, InputMode, Puzzle } from '../../core/types';
import { CELL_COUNT } from '../../core/types';
import { t } from '../../i18n';
import '../../styles/board.scss';
import BoardCell from './BoardCell.vue';
import HeadMarker from './HeadMarker.vue';

const SHAKE_MS = 150;

const props = defineProps<{
  puzzle: Puzzle;
  grid: Uint8Array;
  conflicts: ReadonlyMap<Cell, ConflictKind[]>;
  selected: Cell | null;
  head: Cell | null;
  highlight: Cell | null;
  mode: InputMode;
  readonly: boolean;
}>();

const emit = defineEmits<{
  press: [cell: Cell];
  drag: [cell: Cell];
  dragend: [];
  key: [e: KeyboardEvent];
}>();

const boardEl = ref<HTMLElement | null>(null);
const shakeCell = ref<Cell | null>(null);
let shakeTimer: ReturnType<typeof setTimeout> | null = null;
/** Bumped by every shake() and on unmount, so a stale nextTick callback does nothing. */
let shakeSeq = 0;
let unmounted = false;

/** Active trail drag: the pointer that started it and the last cell reported. */
let dragPointer: number | null = null;
let lastDragCell: Cell | null = null;

const cells = computed(() =>
  Array.from({ length: CELL_COUNT }, (_, cell) => {
    const given = props.puzzle.givens.get(cell);
    return {
      cell,
      value: props.grid[cell] || given || 0,
      kind:
        cell === props.puzzle.start
          ? ('start' as const)
          : props.puzzle.grey[cell]
            ? ('prime' as const)
            : ('normal' as const),
      given: given !== undefined,
      conflict: (props.conflicts.get(cell)?.length ?? 0) > 0,
    };
  }),
);

function cellFromElement(el: Element | null): Cell | null {
  const board = boardEl.value;
  if (!el || !board) return null;
  const btn = el.closest<HTMLElement>('[data-cell]');
  if (!btn || !board.contains(btn)) return null;
  const cell = Number(btn.dataset.cell);
  return Number.isInteger(cell) && cell >= 0 && cell < CELL_COUNT ? cell : null;
}

function cellAtPoint(e: PointerEvent): Cell | null {
  if (typeof document.elementFromPoint !== 'function') return null;
  return cellFromElement(document.elementFromPoint(e.clientX ?? 0, e.clientY ?? 0));
}

function endDrag(): boolean {
  const wasDragging = dragPointer !== null;
  dragPointer = null;
  lastDragCell = null;
  return wasDragging;
}

function onPointerDown(e: PointerEvent): void {
  if (props.readonly) return;
  const cell = cellFromElement(e.target as Element | null);
  if (cell === null) return;
  // Keep keyboard focus on the board (cells are not tab stops) so digits and arrows keep working.
  e.preventDefault();
  focus();
  emit('press', cell);
  if (props.mode !== 'trail') return;
  endDrag();
  dragPointer = e.pointerId ?? 0;
  lastDragCell = cell;
  const board = boardEl.value;
  if (board && typeof board.setPointerCapture === 'function') {
    try {
      board.setPointerCapture(dragPointer);
    } catch {
      // Pointer already released (e.g. synthetic events); dragging still works via elementFromPoint.
    }
  }
}

function onPointerMove(e: PointerEvent): void {
  if (props.readonly || props.mode !== 'trail' || dragPointer === null) return;
  if ((e.pointerId ?? 0) !== dragPointer) return;
  const cell = cellAtPoint(e);
  // Off the board: report nothing but remember the last cell, so re-entering it is not a new cell.
  if (cell === null || cell === lastDragCell) return;
  lastDragCell = cell;
  emit('drag', cell);
}

function onPointerEnd(e: PointerEvent): void {
  if (props.readonly) {
    endDrag();
    return;
  }
  // While a trail drag is active, only its own pointer ends it (a second finger lifting does not).
  if (dragPointer !== null && (e.pointerId ?? 0) !== dragPointer) return;
  endDrag();
  // §6.1: every pointerup / pointercancel emits dragend, in both modes.
  emit('dragend');
}

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta']);

/**
 * The board was focused quietly (mount or a pointer press), so it has no ring; once the player
 * uses the keyboard on it, show the ring. Re-focusing an already focused element is a no-op,
 * hence the blur first.
 */
function showKeyboardFocus(e: KeyboardEvent): void {
  const el = boardEl.value;
  if (!el || e.target !== el || document.activeElement !== el || MODIFIER_KEYS.has(e.key)) return;
  let visible: boolean;
  try {
    visible = el.matches(':focus-visible');
  } catch {
    return; // Selector not supported: leave focus alone.
  }
  if (visible) return;
  el.blur();
  el.focus({ preventScroll: true, focusVisible: true });
}

function onKeyDown(e: KeyboardEvent): void {
  showKeyboardFocus(e);
  if (props.readonly) return;
  // §6.1: Enter on a focused cell is a press (e.g. a cell focused by assistive tech).
  // Enter with focus on the board itself goes out as `key` (direct mode: confirm).
  if (e.key === 'Enter' && e.target !== boardEl.value) {
    const cell = cellFromElement(e.target as Element | null);
    if (cell !== null) {
      e.preventDefault();
      emit('press', cell);
      return;
    }
  }
  emit('key', e);
}

function clearShakeTimer(): void {
  if (shakeTimer !== null) clearTimeout(shakeTimer);
  shakeTimer = null;
}

function shake(cell: Cell): void {
  const seq = ++shakeSeq;
  clearShakeTimer();
  shakeCell.value = null;
  // Let the class removal render and force a reflow so a repeated shake restarts the animation.
  void nextTick(() => {
    // A later shake() or an unmount superseded this one.
    if (seq !== shakeSeq || unmounted) return;
    void boardEl.value?.offsetWidth;
    clearShakeTimer();
    shakeCell.value = cell;
    shakeTimer = setTimeout(() => {
      shakeCell.value = null;
      shakeTimer = null;
    }, SHAKE_MS);
  });
}

/**
 * Programmatic focus (pointer press, PlayView mount). Chrome counts a script focus with no prior
 * pointer interaction as :focus-visible, which drew the keyboard ring on load (§5.1); asking for
 * `focusVisible: false` keeps the ring for real keyboard navigation only.
 */
const QUIET_FOCUS: FocusOptions = { preventScroll: true, focusVisible: false };

function focus(): void {
  boardEl.value?.focus(QUIET_FOCUS);
}

onBeforeUnmount(() => {
  unmounted = true;
  shakeSeq++;
  clearShakeTimer();
});

defineExpose({ shake, focus });
</script>

<template>
  <div
    ref="boardEl"
    class="pt-board"
    :class="{ 'is-readonly': readonly }"
    :data-mode="mode"
    tabindex="0"
    role="group"
    :aria-label="t('board.boardLabel')"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerEnd"
    @pointercancel="onPointerEnd"
    @keydown="onKeyDown"
  >
    <HeadMarker :start="puzzle.start" />
    <BoardCell
      v-for="c in cells"
      :key="c.cell"
      :cell="c.cell"
      :value="c.value"
      :kind="c.kind"
      :given="c.given"
      :selected="selected === c.cell"
      :head="head === c.cell"
      :highlight="highlight === c.cell"
      :conflict="c.conflict"
      :shake="shakeCell === c.cell"
    />
  </div>
</template>
