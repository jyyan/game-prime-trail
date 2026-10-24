<script setup lang="ts">
import { computed } from 'vue';
import { colOf, edgeSides, rowOf } from '../../core/geometry';
import type { Cell } from '../../core/types';

const props = defineProps<{ start: Cell }>();

const sides = computed(() => edgeSides(props.start));
const position = computed(() => ({
  '--row': rowOf(props.start),
  '--col': colOf(props.start),
}));
</script>

<template>
  <span
    v-for="side in sides"
    :key="side"
    class="pt-head-marker"
    :class="`pt-head-marker--${side}`"
    :style="position"
    aria-hidden="true"
  />
</template>
