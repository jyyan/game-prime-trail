<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import GameBoard from '../components/board/GameBoard.vue';
import PdfExportDialog from '../components/game/PdfExportDialog.vue';
import PlayActions from '../components/game/PlayActions.vue';
import SolutionView from '../components/game/SolutionView.vue';
import WinModal from '../components/game/WinModal.vue';
import InputModeToggle from '../components/input/InputModeToggle.vue';
import NumberPad from '../components/input/NumberPad.vue';
import BsModal from '../components/ui/BsModal.vue';
import StatusBar from '../components/ui/StatusBar.vue';
import { usePlaySession } from '../composables/usePlaySession';
import type { Difficulty, InputMode } from '../core/types';
import { t } from '../i18n';

const props = defineProps<{ id: string; difficulty: Difficulty }>();

const router = useRouter();
const levelId = computed(() => Number(props.id));
const difficulty = computed(() => props.difficulty);

const session = usePlaySession(levelId, difficulty);
const {
  status,
  game,
  level,
  highlight,
  shakeTarget,
  winResult,
  showWin,
  showSolution,
  showPdf,
} = session;

const board = ref<InstanceType<typeof GameBoard> | null>(null);

watch(shakeTarget, (target) => {
  if (target) board.value?.shake(target.cell);
});

const state = computed(() => game.value?.state ?? null);
const won = computed(() => state.value?.status === 'won');
const canUndo = computed(() => !won.value && (state.value?.undo.length ?? 0) > 0);

function setInputMode(mode: InputMode): void {
  game.value?.setInputMode(mode);
}

function onNextRandom(): void {
  const id = session.nextRandom();
  if (id !== null) void router.push({ name: 'play', params: { id: String(id), difficulty: props.difficulty } });
}

function openPdf(): void {
  showWin.value = false;
  showPdf.value = true;
}
</script>

<template>
  <section data-view="play" class="pt-play mx-auto py-2">
    <p v-if="status === 'loading'" class="text-body-secondary" data-play-status="loading">{{ t('play.loading') }}</p>
    <div v-else-if="status === 'missing' || status === 'error'" :data-play-status="status">
      <p class="mb-2">{{ status === 'missing' ? t('play.levelMissing') : t('play.loadError') }}</p>
      <RouterLink to="/" class="btn btn-outline-primary">{{ t('common.back') }}</RouterLink>
    </div>
    <template v-else-if="game && state && level">
      <div class="pt-play__board-wrap">
        <GameBoard
          ref="board"
          :puzzle="game.puzzle"
          :grid="state.grid"
          :conflicts="game.conflicts.value"
          :selected="state.inputMode === 'direct' ? state.selected : null"
          :head="state.inputMode === 'trail' ? game.headCell.value : null"
          :highlight="highlight"
          :mode="state.inputMode"
          :readonly="won"
          @press="session.onPress"
          @drag="session.onDrag"
          @key="session.onKey"
        />
      </div>
      <div class="d-flex flex-column gap-2 mt-2">
        <StatusBar
          :level-id="state.levelId"
          :difficulty="state.difficulty"
          :elapsed-ms="game.elapsedMs.value"
          :steps="state.steps"
          :assisted="state.assisted"
        />
        <InputModeToggle :model-value="state.inputMode" @update:model-value="setInputMode" />
        <NumberPad
          v-if="state.inputMode === 'direct'"
          :disabled="won"
          :pending="state.pending"
          @digit="session.onDigit"
          @clear="session.onClear"
          @confirm="session.onConfirm"
        />
        <PlayActions
          :can-undo="canUndo"
          :input-mode="state.inputMode"
          @undo="session.undo"
          @clear="session.onClear"
          @hint="session.hint"
          @restart="session.requestRestart"
          @view-solution="session.requestViewSolution"
          @export-pdf="openPdf"
          @update:input-mode="setInputMode"
        />
      </div>

      <WinModal
        v-model="showWin"
        :level-id="state.levelId"
        :difficulty="state.difficulty"
        :elapsed-ms="game.elapsedMs.value"
        :steps="state.steps"
        :best="winResult ? { bestMs: winResult.entry.bestMs, bestSteps: winResult.entry.bestSteps } : null"
        :is-new-best="winResult?.isNewBest ?? { time: false, steps: false }"
        :assisted="state.assisted"
        @view-solution="session.requestViewSolution"
        @next-random="onNextRandom"
        @back-home="router.push('/')"
        @export-pdf="openPdf"
      />
      <BsModal v-model="showSolution" size="lg" :title="t('solution.title')" :close-label="t('common.close')">
        <SolutionView :level="level" :puzzle="game.puzzle" :player-grid="state.grid" :solved="won" />
      </BsModal>
      <PdfExportDialog
        v-model="showPdf"
        :game-status="state.status"
        @mark-assisted="session.markAssisted"
        @export="session.exportPdf"
      />
    </template>
  </section>
</template>

<style scoped>
.pt-play {
  max-width: 560px;
}

.pt-play__board-wrap {
  overflow-x: auto;
}
</style>
