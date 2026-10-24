<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Cell, ConflictKind, Level, Puzzle } from '../../core/types';
import { conflictMap, findConflicts, gridEquals } from '../../core/validate';
import { t } from '../../i18n';
import GameBoard from '../board/GameBoard.vue';

const props = defineProps<{
  level: Level;
  puzzle: Puzzle;
  playerGrid: Uint8Array;
  solved: boolean;
}>();

type View = 'reference' | 'mine';
const VIEWS: readonly View[] = ['mine', 'reference'];

const view = ref<View>('reference');

const NO_CONFLICTS: ReadonlyMap<Cell, ConflictKind[]> = new Map();

const grid = computed(() => (view.value === 'reference' ? props.level.numberAt : props.playerGrid));
const conflicts = computed(() =>
  view.value === 'reference' ? NO_CONFLICTS : conflictMap(findConflicts(props.playerGrid, props.puzzle)),
);

// Spec §6.8: a winning grid that differs from the reference path is another valid solution.
const alsoValid = computed(() => props.solved && !gridEquals(props.playerGrid, props.level.numberAt));
</script>

<template>
  <div class="pt-solution">
    <div class="btn-group btn-group-sm w-100 mb-2" role="group" :aria-label="t('solution.switchView')">
      <button
        v-for="v in VIEWS"
        :key="v"
        type="button"
        class="btn"
        :class="v === view ? 'btn-primary active' : 'btn-outline-primary'"
        :data-view="v"
        :aria-pressed="v === view ? 'true' : 'false'"
        @click="view = v"
      >
        {{ v === 'mine' ? t('solution.mine') : t('solution.reference') }}
      </button>
    </div>
    <p v-if="alsoValid" class="alert alert-success py-1 px-2 mb-2 small" data-also-valid>
      {{ t('solution.alsoValid') }}
    </p>
    <GameBoard
      :puzzle="puzzle"
      :grid="grid"
      :conflicts="conflicts"
      :selected="null"
      :head="null"
      :highlight="null"
      mode="direct"
      :readonly="true"
    />
  </div>
</template>
