<script setup lang="ts">
import { computed } from 'vue';
import { colOf, rowOf } from '../../core/geometry';
import type { Cell } from '../../core/types';
import { t } from '../../i18n';
import type { CellMark } from './marks';

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
  mark?: CellMark;
  trail?: boolean;
}>();

const row = computed(() => rowOf(props.cell));
const col = computed(() => colOf(props.cell));

const classes = computed(() => ({
  'is-start': props.kind === 'start',
  'is-prime': props.kind === 'prime',
  'is-given': props.given,
  'is-filled': props.value > 0 && !props.given,
  'is-selected': props.selected,
  'is-head': props.head,
  'is-highlight': props.highlight,
  'is-conflict': props.conflict,
  'is-shake': props.shake,
  'is-trail': props.trail === true,
  'is-mark-reject': props.mark === 'reject',
  'is-mark-trap': props.mark === 'trap',
  'is-mark-branch': props.mark === 'branch',
}));

// Track 1 of each axis is the half-cell outer band, so cell (r, c) sits at track r+2 / c+2.
const placement = computed(() => ({ gridRow: row.value + 2, gridColumn: col.value + 2 }));

const label = computed(() => {
  let content: string;
  if (props.value > 0) content = t('board.number', { n: props.value });
  else if (props.kind === 'prime') content = t('board.primeCell');
  else content = t('board.empty');
  if (props.mark === 'reject') content += `，${t('deadEnd.markReject')}`;
  else if (props.mark === 'trap') content += `，${t('deadEnd.markTrap')}`;
  else if (props.mark === 'branch') content += `，${t('demo.markBranch')}`;
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
    <span v-if="trail" class="pt-num-corner">{{ value > 0 ? value : '' }}</span>
    <template v-else>{{ value > 0 ? value : '' }}</template>
  </button>
</template>
