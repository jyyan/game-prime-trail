<script setup lang="ts">
import { computed } from 'vue';
import { t, type MessageKey } from '../../i18n';
import BsModal from '../ui/BsModal.vue';

/**
 * Full controls help (controls-help spec §5): touch and keyboard sections, the player's device
 * first, each split by input mode, then the shared buttons. Covers every operation of main spec §7.3.
 */
const props = defineProps<{ modelValue: boolean; device: 'touch' | 'pointer' }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

type Device = 'touch' | 'pointer';

/** `{token}` in a help string → the keys shown as <kbd> (see src/i18n/zh-TW/help.ts). */
const KEYS: Readonly<Record<string, readonly string[]>> = {
  arrows: ['↑', '↓', '←', '→'],
  backspace: ['Backspace'],
  del: ['Delete'],
  tab: ['Tab'],
  enter: ['Enter'],
  ctrl: ['Ctrl'],
  cmd: ['Cmd'],
  z: ['Z'],
  digits: ['0–9'],
};

const LINES: Readonly<Record<Device, { trail: MessageKey[]; direct: MessageKey[] }>> = {
  touch: {
    trail: ['help.touchTrailTap', 'help.touchTrailDrag', 'help.touchTrailBack'],
    direct: ['help.touchDirectFill', 'help.touchDirectClear'],
  },
  pointer: {
    trail: [
      'help.pointerTrailClick',
      'help.pointerTrailArrows',
      'help.pointerTrailBack',
      'help.pointerToggle',
      'help.pointerUndo',
    ],
    direct: [
      'help.pointerDirectSelect',
      'help.pointerDirectFill',
      'help.pointerDirectBack',
      'help.pointerToggle',
      'help.pointerUndo',
    ],
  },
};

const MODES = ['trail', 'direct'] as const;

const SHARED: readonly MessageKey[] = [
  'help.sharedUndo',
  'help.sharedHint',
  'help.sharedSolution',
  'help.sharedPdf',
  'help.sharedRestart',
];

const SECTION_TITLE: Readonly<Record<Device, MessageKey>> = {
  touch: 'help.sectionTouch',
  pointer: 'help.sectionPointer',
};

const order = computed<Device[]>(() => (props.device === 'touch' ? ['touch', 'pointer'] : ['pointer', 'touch']));

function parts(key: MessageKey): Array<{ text?: string; keys?: readonly string[] }> {
  return t(key)
    .split(/(\{\w+\})/)
    .filter((s) => s !== '')
    .map((s) => {
      const name = /^\{(\w+)\}$/.exec(s)?.[1];
      return name && KEYS[name] ? { keys: KEYS[name] } : { text: s };
    });
}
</script>

<template>
  <BsModal
    :model-value="modelValue"
    :title="t('help.title')"
    :close-label="t('common.close')"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="pt-help">
      <section v-for="d in order" :key="d" class="pt-help__section" :data-help-section="d">
        <h3 class="pt-help__heading">{{ t(SECTION_TITLE[d]) }}</h3>
        <template v-for="mode in MODES" :key="mode">
          <h4 class="pt-help__mode">{{ t(mode === 'trail' ? 'help.modeTrail' : 'help.modeDirect') }}</h4>
          <ul class="pt-help__list">
            <li v-for="key in LINES[d][mode]" :key="key">
              <template v-for="(part, i) in parts(key)" :key="i">
                <template v-if="part.keys">
                  <kbd v-for="k in part.keys" :key="k" class="pt-kbd">{{ k }}</kbd>
                </template>
                <template v-else>{{ part.text }}</template>
              </template>
            </li>
          </ul>
        </template>
      </section>
      <section class="pt-help__section" data-help-section="shared">
        <h3 class="pt-help__heading">{{ t('help.sectionShared') }}</h3>
        <ul class="pt-help__list">
          <li v-for="key in SHARED" :key="key">{{ t(key) }}</li>
        </ul>
      </section>
    </div>
  </BsModal>
</template>

<style scoped>
.pt-help {
  color: var(--pt-text);
}

.pt-help__section + .pt-help__section {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--pt-text-muted);
}

.pt-help__heading {
  margin: 0 0 0.25rem;
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--pt-primary-strong);
}

.pt-help__mode {
  margin: 0.5rem 0 0.125rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--pt-text);
}

.pt-help__list {
  margin: 0;
  padding-left: 1.25rem;
  line-height: 1.7;
}

.pt-kbd {
  display: inline-block;
  min-width: 1.6em;
  margin: 0 0.125rem;
  padding: 0 0.3em;
  font-family: var(--pt-font-num);
  font-size: 0.85em;
  line-height: 1.5;
  text-align: center;
  color: var(--pt-text);
  background: var(--pt-bg);
  border: 1px solid var(--pt-text-muted);
  border-bottom-width: 2px;
  border-radius: 6px;
}
</style>
