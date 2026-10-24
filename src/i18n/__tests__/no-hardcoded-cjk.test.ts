import { describe, expect, it } from 'vitest';

// CJK Unified Ideographs (incl. Extension A, U+3400–U+9FFF) and CJK Compatibility Ideographs (U+F900–U+FAFF).
const CJK = new RegExp('[\\u3400-\\u9fff\\uf900-\\ufaff]');

// Every .ts/.vue source under src/ except the string tables and test-only files.
const sources = import.meta.glob<string>(
  [
    '/src/**/*.{ts,vue}',
    '!/src/i18n/**',
    '!**/__tests__/**',
    '!**/__fixtures__/**',
    '!**/*.test.ts',
  ],
  { query: '?raw', import: 'default', eager: true },
);

describe('no hard-coded CJK outside src/i18n', () => {
  it('scans the expected files', () => {
    const files = Object.keys(sources);
    expect(files).toContain('/src/App.vue');
    expect(files).toContain('/src/core/types.ts');
    expect(files.some((f) => f.startsWith('/src/i18n/'))).toBe(false);
    expect(files.some((f) => f.includes('/__tests__/'))).toBe(false);
  });

  it('detects CJK characters', () => {
    expect(CJK.test('第')).toBe(true);
    expect(CJK.test('切')).toBe(true);
    expect(CJK.test('Prime Trail 1-100')).toBe(false);
  });

  it('finds no CJK characters in component or non-i18n .ts files', () => {
    const hits: string[] = [];
    for (const [file, text] of Object.entries(sources)) {
      text.split('\n').forEach((line, i) => {
        if (CJK.test(line)) hits.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    if (hits.length > 0) {
      expect.fail(`Move these strings into src/i18n/zh-TW/:\n${hits.join('\n')}`);
    }
  });
});
