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
import { formatMs, padId } from '../components/format';
import { usePlaySession } from '../composables/usePlaySession';
import { CELL_COUNT, type Difficulty, type InputMode } from '../core/types';
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

// Focus the board once it is on screen so arrows and digits work straight away. GameBoard.focus()
// asks for no focus ring: the ring is for keyboard navigation only (UI refresh spec §5.1).
watch(board, (b) => b?.focus(), { flush: 'post' });

const state = computed(() => game.value?.state ?? null);
const won = computed(() => state.value?.status === 'won');
const canUndo = computed(() => !won.value && (state.value?.undo.length ?? 0) > 0);

const title = computed(() =>
  state.value
    ? `${t('status.level', { id: padId(state.value.levelId) })}・${t(`difficulty.${state.value.difficulty}`)}`
    : '',
);
const elapsed = computed(() => formatMs(game.value?.elapsedMs.value ?? 0));
/** Trail mode: the number the next cell gets (spec §4.3); null once the head is 100. */
const next = computed(() => {
  const head = game.value?.head.value ?? 0;
  return head > 0 && head < CELL_COUNT ? head + 1 : null;
});

/** Bumped whenever a digit (pad or keyboard) is refused, so the status bar can flash (§4.3). */
const rejectSeq = ref(0);

function trackDigit(run: () => void): void {
  const g = game.value;
  const watched = g !== null && g.state.inputMode === 'direct' && g.state.status !== 'won';
  const before = g?.state.pending;
  run();
  // An accepted digit always grows `pending`; an unchanged one was refused (it would leave 1–100).
  if (watched && g.state.pending === before) rejectSeq.value++;
}

function onDigit(d: number): void {
  trackDigit(() => session.onDigit(d));
}

function onBoardKey(e: KeyboardEvent): void {
  if (/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) trackDigit(() => session.onKey(e));
  else session.onKey(e);
}

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
      <header class="pt-play-topbar" :aria-label="t('play.topBar')">
        <RouterLink to="/" class="btn btn-outline-secondary pt-play-topbar__home" data-action="home" :aria-label="t('play.homeLabel')">
          <span aria-hidden="true">←</span> {{ t('play.home') }}
        </RouterLink>
        <h1 class="pt-play-topbar__title" data-level-title>{{ title }}</h1>
        <span class="pt-play-topbar__timer pt-num" role="timer" data-timer :aria-label="t('status.time', { time: elapsed })">{{
          elapsed
        }}</span>
      </header>
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
          @key="onBoardKey"
        />
      </div>
      <div class="d-flex flex-column gap-2 mt-2">
        <StatusBar
          :steps="state.steps"
          :assisted="state.assisted"
          :mode="state.inputMode"
          :next="next"
          :pending="state.pending"
          :reject-seq="rejectSeq"
        />
        <InputModeToggle :model-value="state.inputMode" @update:model-value="setInputMode" />
        <NumberPad
          v-if="state.inputMode === 'direct'"
          :disabled="won"
          @digit="onDigit"
          @clear="session.onClear"
          @confirm="session.onConfirm"
        />
        <PlayActions
          :can-undo="canUndo"
          @undo="session.undo"
          @hint="session.hint"
          @restart="session.requestRestart"
          @view-solution="session.requestViewSolution"
          @export-pdf="openPdf"
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

/* .pt-play__board-wrap deliberately sets no overflow: any non-visible overflow-x also turns
   overflow-y into auto and clips the board's clay shadow (GAME-27). Since GAME-22 the board fits
   viewports down to ~302px, so there is nothing to scroll. */

.pt-play-topbar {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.pt-play-topbar__home {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 44px;
  white-space: nowrap;
}

.pt-play-topbar__title {
  margin: 0;
  overflow: hidden;
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pt-play-topbar__timer {
  min-width: 4.5ch;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--pt-primary-strong);
  text-align: end;
}
</style>
