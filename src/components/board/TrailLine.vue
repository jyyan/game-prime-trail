<script setup lang="ts">
import { computed } from 'vue';
import { colOf, rowOf } from '../../core/geometry';
import type { Cell } from '../../core/types';

/** trail[k-1] = cell holding number k. Drawn as one polyline through the cell centres. */
const props = defineProps<{ trail: readonly Cell[] }>();

// Units: one cell = 1; the board has a half-cell band on every side, so cell (r, c) centres at (c+1, r+1).
const points = computed(() =>
  props.trail.map((cell) => `${colOf(cell) + 1},${rowOf(cell) + 1}`).join(' '),
);
</script>

<template>
  <svg class="pt-trail" viewBox="0 0 11 11" aria-hidden="true" focusable="false">
    <polyline :points="points" />
  </svg>
</template>
