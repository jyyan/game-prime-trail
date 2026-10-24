import { ref, type Ref } from 'vue';
import type { Locale, MessageKey, Messages } from './types';
import { zhTW } from './zh-TW';

export type { Locale, MessageKey, Messages } from './types';

export const messages: Readonly<Record<Locale, Messages>> = Object.freeze({ 'zh-TW': zhTW });

const locale = ref<Locale>('zh-TW');

function lookup(key: string): string | undefined {
  let node: unknown = messages[locale.value];
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || !Object.hasOwn(node, part)) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Look up `key` and replace `{name}` placeholders; unknown keys return the key itself. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = lookup(key);
  if (template === undefined) {
    console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}

export function useI18n(): { t: typeof t; locale: Ref<Locale> } {
  return { t, locale };
}
