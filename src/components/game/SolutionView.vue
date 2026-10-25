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
    <div class="pt-solution__toggle mb-2" role="group" :aria-label="t('solution.switchView')">
      <button
        v-for="v in VIEWS"
        :key="v"
        type="button"
        class="btn pt-solution__btn"
        :class="v === view ? 'btn-primary active' : 'btn-outline-primary'"
        :data-view="v"
        :aria-pressed="v === view ? 'true' : 'false'"
        @click="view = v"
      >
        {{ v === 'mine' ? t('solution.mine') : t('solution.reference') }}
      </button>
    </div>
    <p v-if="alsoValid" class="pt-solution__note mb-2 small" data-also-valid>
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

<style scoped>
/*
 * The shared board sizes --cell from the viewport (src/styles/board.scss), but inside the
 * solution dialog the available width is the modal body, which is narrower than 100vw - 16px.
 * Size the cells from this container instead so the 11-unit-wide board never overflows it.
 * The 20px floor still fits a 320px-wide phone (modal body ≈ 270px ≥ 11 × 20px).
 */
.pt-solution {
  container-type: inline-size;
}

/* Bootstrap's button-group and alert partials are not in the slimmed stylesheet (GAME-28), so the
   toggle is a scoped two-column joined segmented control and the note is token-styled. */
.pt-solution__toggle {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
}

.pt-solution__btn {
  min-height: 44px;
}

.pt-solution__btn:first-child {
  border-start-end-radius: 0;
  border-end-end-radius: 0;
}

.pt-solution__btn:last-child {
  border-start-start-radius: 0;
  border-end-start-radius: 0;
}

/* --pt-success is decorative (accent bar); the --pt-text on --pt-surface text pair is contrast-checked. */
.pt-solution__note {
  padding: 0.5rem 0.75rem;
  color: var(--pt-text);
  background: var(--pt-surface);
  border: 1px solid var(--pt-success);
  border-inline-start-width: 4px;
  border-radius: var(--bs-border-radius);
}

.pt-solution :deep(.pt-board) {
  --cell: clamp(20px, calc(100cqi / 11), 48px);
}
</style>
