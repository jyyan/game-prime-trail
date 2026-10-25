<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { pickDemo, type DemoPick, type DemoReason } from '../../core/demo-solver';
import { derivePuzzle } from '../../core/level-decode';
import type { Puzzle } from '../../core/types';
import { useDemoPlayback, type DemoDir, type DemoMessage } from '../../composables/useDemoPlayback';
import { useLevelStore } from '../../composables/useLevelStore';
import { t, type MessageKey } from '../../i18n';
import GameBoard from '../board/GameBoard.vue';
import BsModal from '../ui/BsModal.vue';

// Home page "how to play" demo (demo-playback spec §5). Reads only the level library; never touches
// progress, records, saves or the ui prefs (§7).

const props = defineProps<{
  modelValue: boolean;
  /** Random source for picking the map (tests inject a fixed one). */
  random?: () => number;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const store = useLevelStore();
const playback = useDemoPlayback();
const frame = playback.frame;
const phase = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
const pick = shallowRef<DemoPick | null>(null);
const puzzle = shallowRef<Puzzle | null>(null);
const NO_CONFLICTS = new Map();
/** Bumped on every open / close so a load that settles late does not start a stale run. */
let generation = 0;

// pickDemo averages ~11 ms per call on a desktop over the 1000-map library (GAME-33), under the
// plan's 30 ms threshold, so it runs synchronously.
function playNext(): void {
  playback.stop();
  try {
    const next = pickDemo(store.count.value, store.getLevel, props.random ?? Math.random);
    pick.value = next;
    puzzle.value = derivePuzzle(store.getLevel(next.levelId), 'easy');
    playback.start(next, puzzle.value);
    phase.value = 'ready';
  } catch {
    phase.value = 'error';
  }
}

async function begin(): Promise<void> {
  const gen = ++generation;
  phase.value = 'loading';
  try {
    await store.load();
  } catch {
    // load() reports failures through status; nothing to do here.
  }
  if (gen !== generation) return;
  if (store.status.value !== 'ready') {
    phase.value = 'error';
    return;
  }
  playNext();
}

function end(): void {
  generation++;
  playback.stop();
  phase.value = 'idle';
  pick.value = null;
  puzzle.value = null;
}

watch(
  () => props.modelValue,
  (open) => (open ? void begin() : end()),
  { immediate: true },
);

onBeforeUnmount(end);

const DIR_KEY: Record<DemoDir, MessageKey> = {
  up: 'demo.dirUp',
  down: 'demo.dirDown',
  left: 'demo.dirLeft',
  right: 'demo.dirRight',
};

function reasonText(r: DemoReason, next: number): string {
  switch (r.kind) {
    case 'otherGiven':
      return t('demo.reason.otherGiven', { v: r.value ?? '' });
    case 'far':
      return t('demo.reason.far', { v: r.value ?? '', dist: r.dist ?? '', steps: r.steps ?? '' });
    default:
      return t(`demo.reason.${r.kind}`, { n: next });
  }
}

const lines = computed<{ title: string; items: string[] }>(() => {
  const m: DemoMessage | undefined = frame.value?.message;
  if (!m) return { title: '', items: [] };
  switch (m.kind) {
    case 'intro':
      return { title: t('demo.intro', { n: 1 }), items: [] };
    case 'progress':
      return { title: t('demo.filling', { n: m.n }), items: [] };
    case 'prime':
      return { title: t('demo.prime', { n: m.n }), items: [] };
    case 'stuck':
      if (m.lines.length === 0) {
        return { title: `${t('demo.stuckTitle', { n: m.n, next: m.n + 1 })}${t('demo.stuckAllUsed')}`, items: [] };
      }
      return {
        title: t('demo.stuckTitle', { n: m.n, next: m.n + 1 }),
        items: m.lines.map((l) => t('demo.stuckLine', { dir: t(DIR_KEY[l.dir]), reason: reasonText(l.reason, m.n + 1) })),
      };
    case 'back':
      return { title: t('demo.backtrack', { m: m.m }), items: [] };
    case 'branch':
      return { title: t('demo.reroute', { m: m.m }), items: [] };
    case 'done':
      return { title: t('demo.done', { k: m.backtracks }), items: [] };
  }
  return { title: '', items: [] };
});

const mapInfo = computed(() =>
  pick.value
    ? t('demo.mapInfo', { n: pick.value.levelId, difficulty: t('difficulty.easy'), k: pick.value.trace.backtracks })
    : '',
);
</script>

<template>
  <BsModal
    :model-value="modelValue"
    :title="t('demo.title')"
    :close-label="t('common.close')"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="pt-demo" data-demo :data-phase="phase" :data-done="frame?.done ? 'true' : 'false'">
      <p class="pt-demo-info small mb-2" data-demo-info>{{ phase === 'ready' ? mapInfo : '' }}</p>
      <div class="pt-demo-say mb-2" aria-live="polite" data-demo-say>
        <template v-if="phase === 'loading'">{{ t('demo.loading') }}</template>
        <p v-else-if="phase === 'error'" class="pt-demo-error mb-0" data-demo-error>{{ t('demo.loadFailed') }}</p>
        <template v-else-if="phase === 'ready'">
          <p class="mb-1" data-demo-title>{{ lines.title }}</p>
          <ul v-if="lines.items.length" class="pt-demo-lines mb-0" data-demo-lines>
            <li v-for="(item, i) in lines.items" :key="i">{{ item }}</li>
          </ul>
        </template>
      </div>
      <GameBoard
        v-if="phase === 'ready' && frame && puzzle"
        class="pt-demo-board"
        :puzzle="puzzle"
        :grid="frame.grid"
        :conflicts="NO_CONFLICTS"
        :selected="null"
        :head="frame.head"
        :highlight="null"
        mode="direct"
        :readonly="true"
        :marks="frame.marks"
        :trail="frame.trail"
      />
      <div class="d-flex justify-content-center mt-3">
        <button
          type="button"
          class="btn btn-outline-primary pt-demo-again"
          data-action="demoAgain"
          :disabled="phase === 'loading'"
          :aria-busy="phase === 'loading' ? 'true' : 'false'"
          @click="phase === 'error' ? begin() : playNext()"
        >
          {{ t('demo.again') }}
        </button>
      </div>
    </div>
  </BsModal>
</template>

<style scoped>
.pt-demo-info {
  min-height: 1.5em;
  color: var(--pt-text-muted);
}

/* Fixed height (spec §5.2): up to three reason lines fit without the board jumping. */
.pt-demo-say {
  height: 11.5rem;
  overflow-y: auto;
}

@media (min-width: 576px) {
  .pt-demo-say {
    height: 8.5rem;
  }
}

.pt-demo-lines {
  padding-inline-start: 1.1rem;
}

.pt-demo-error {
  color: var(--pt-danger);
}

/* Inside the dialog the board loses the modal margins and padding; keep it inside 320px. */
.pt-demo :deep(.pt-board) {
  --cell: clamp(22px, calc((100vw - 64px) / 11), 40px);
}

.pt-demo-again {
  min-height: 44px;
}
</style>
