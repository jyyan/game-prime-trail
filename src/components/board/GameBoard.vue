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
  boardEl.value?.focus({ preventScroll: true });
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
  if (dragPointer !== null && (e.pointerId ?? 0) !== dragPointer) return;
  if (endDrag()) emit('dragend');
}

function onKeyDown(e: KeyboardEvent): void {
  if (props.readonly) return;
  emit('key', e);
}

function shake(cell: Cell): void {
  if (shakeTimer !== null) clearTimeout(shakeTimer);
  shakeTimer = null;
  shakeCell.value = null;
  // Let the class removal render and force a reflow so a repeated shake restarts the animation.
  void nextTick(() => {
    void boardEl.value?.offsetWidth;
    shakeCell.value = cell;
    shakeTimer = setTimeout(() => {
      shakeCell.value = null;
      shakeTimer = null;
    }, SHAKE_MS);
  });
}

function focus(): void {
  boardEl.value?.focus();
}

onBeforeUnmount(() => {
  if (shakeTimer !== null) clearTimeout(shakeTimer);
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
