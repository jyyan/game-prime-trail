<script setup lang="ts">
import { computed } from 'vue';
import { colOf, rowOf } from '../../core/geometry';
import type { Cell } from '../../core/types';
import { t } from '../../i18n';

const props = defineProps<{
  value: number;
  kind: 'start' | 'prime' | 'normal';
  given: boolean;
  selected: boolean;
  head: boolean;
  highlight: boolean;
  conflict: boolean;
  shake: boolean;
  cell: Cell;
}>();

const row = computed(() => rowOf(props.cell));
const col = computed(() => colOf(props.cell));

const classes = computed(() => ({
  'is-start': props.kind === 'start',
  'is-prime': props.kind === 'prime',
  'is-given': props.given,
  'is-selected': props.selected,
  'is-head': props.head,
  'is-highlight': props.highlight,
  'is-conflict': props.conflict,
  'is-shake': props.shake,
}));

// Track 1 of each axis is the half-cell outer band, so cell (r, c) sits at track r+2 / c+2.
const placement = computed(() => ({ gridRow: row.value + 2, gridColumn: col.value + 2 }));

const label = computed(() => {
  let content: string;
  if (props.value > 0) content = t('board.number', { n: props.value });
  else if (props.kind === 'prime') content = t('board.primeCell');
  else content = t('board.empty');
  return t('board.cellLabel', { r: row.value + 1, c: col.value + 1, content });
});
</script>

<template>
  <button
    type="button"
    class="pt-cell"
    :class="classes"
    :style="placement"
    :data-cell="cell"
    :aria-label="label"
    tabindex="-1"
  >
    {{ value > 0 ? value : '' }}
  </button>
</template>
