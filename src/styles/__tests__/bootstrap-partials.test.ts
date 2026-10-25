import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Drift guard (GAME-28 / R48): src/styles/main.scss imports only some Bootstrap partials. A Vue
 * template that uses a class from a partial that is NOT imported renders unstyled. Each rule maps a
 * class pattern to the partial that provides it; if a template uses the class and main.scss does
 * not import the partial, the test fails naming the file and class. Fix by styling the component
 * with scoped CSS and --pt-* tokens, not by importing the partial globally.
 */
const RULES: Array<{ partial: string; classes: RegExp }> = [
  { partial: 'button-group', classes: /^btn-(group|toolbar)(-[a-z]+)?$/ },
  { partial: 'helpers', classes: /^text-bg-[a-z]+$/ },
  { partial: 'alert', classes: /^alert(-[a-z]+)?$/ },
  { partial: 'card', classes: /^card(-[a-z]+)?$/ },
  { partial: 'dropdown', classes: /^dropdown(-[a-z]+)?$/ },
  { partial: 'list-group', classes: /^list-group(-[a-z]+)?$/ },
  { partial: 'nav', classes: /^nav(-[a-z]+)?$/ },
  { partial: 'navbar', classes: /^navbar(-[a-z]+)?$/ },
  { partial: 'progress', classes: /^progress(-bar)?$/ },
  { partial: 'spinners', classes: /^spinner-(border|grow)(-sm)?$/ },
  { partial: 'accordion', classes: /^accordion(-[a-z]+)?$/ },
  { partial: 'tooltip', classes: /^tooltip(-[a-z]+)?$/ },
  { partial: 'popover', classes: /^popover(-[a-z]+)?$/ },
];

const SRC = join(__dirname, '..', '..');

function vueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'node_modules' ? [] : vueFiles(p);
    return p.endsWith('.vue') ? [p] : [];
  });
}

describe('Bootstrap partials used by templates are imported in main.scss', () => {
  const scss = readFileSync(join(SRC, 'styles', 'main.scss'), 'utf8');
  const imported = new Set([...scss.matchAll(/@import\s+'bootstrap\/scss\/([\w-]+)'/g)].map((m) => m[1]));

  it('finds the imported partials', () => {
    expect(imported.has('buttons')).toBe(true);
  });

  it('no template uses a class whose partial is missing', () => {
    const violations: string[] = [];
    for (const file of vueFiles(SRC)) {
      const sfc = readFileSync(file, 'utf8');
      const template = sfc.match(/<template[^>]*>([\s\S]*)<\/template>/)?.[1] ?? '';
      const used = new Set<string>();
      for (const m of template.matchAll(/\bclass="([^"]*)"/g)) m[1].split(/\s+/).forEach((c) => c && used.add(c));
      // Quoted strings inside :class bindings, e.g. :class="ok ? 'alert alert-success' : ''"
      for (const m of template.matchAll(/:class="([^"]*)"/g)) {
        for (const q of m[1].matchAll(/'([^']*)'/g)) q[1].split(/\s+/).forEach((c) => c && used.add(c));
      }
      for (const cls of used) {
        for (const rule of RULES) {
          if (rule.classes.test(cls) && !imported.has(rule.partial)) {
            violations.push(`${relative(SRC, file)}: "${cls}" needs bootstrap/scss/${rule.partial}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
