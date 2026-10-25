import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');
const read = (f: string) => readFileSync(resolve(root, f), 'utf8');
const html = read('index.html');
const ORIGIN = 'https://game-prime-trail.jyyan.info';

function metaContent(attr: 'name' | 'property', key: string): string | undefined {
  const m = html.match(new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`));
  return m?.[1];
}

describe('index.html SEO/GEO meta', () => {
  it('has title and description', () => {
    expect(html).toMatch(/<title>Prime Trail｜質數小路[^<]+<\/title>/);
    expect(metaContent('name', 'description')).toContain('1000 道固定題目');
  });

  it('points canonical to the home page with an absolute URL', () => {
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/" />`);
  });

  it('has Open Graph tags with an absolute og:image', () => {
    expect(metaContent('property', 'og:type')).toBe('website');
    expect(metaContent('property', 'og:locale')).toBe('zh_TW');
    expect(metaContent('property', 'og:image')).toBe(`${ORIGIN}/og-image.jpg`);
    expect(metaContent('property', 'og:image:width')).toBe('1200');
    expect(metaContent('property', 'og:image:height')).toBe('630');
    expect(metaContent('property', 'og:image:alt')).toBeTruthy();
  });

  it('has a large-image Twitter card', () => {
    expect(metaContent('name', 'twitter:card')).toBe('summary_large_image');
  });

  it('has parseable JSON-LD', () => {
    const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(m).not.toBeNull();
    const ld = JSON.parse(m![1]);
    expect(ld['@type']).toEqual(['VideoGame', 'WebApplication']);
    expect(ld.inLanguage).toBe('zh-TW');
    expect(ld.isAccessibleForFree).toBe(true);
    expect(ld.offers.price).toBe('0');
    expect(ld.image).toBe(`${ORIGIN}/og-image.jpg`);
  });

  it('keeps charset, viewport and lang', () => {
    expect(html).toContain('<html lang="zh-TW">');
    expect(html).toContain('<meta charset="UTF-8" />');
    expect(html).toContain('name="viewport"');
  });

  it('ships robots, sitemap and llms.txt with absolute URLs', () => {
    expect(read('public/robots.txt')).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
    expect(read('public/sitemap.xml')).toContain(`<loc>${ORIGIN}/</loc>`);
    expect(read('public/llms.txt')).toMatch(/^# Prime Trail/);
  });

  it('never mentions trademarked puzzle names (anti-goal)', () => {
    for (const f of ['index.html', 'public/robots.txt', 'public/sitemap.xml', 'public/llms.txt']) {
      expect(read(f)).not.toMatch(/hidato|numbrix/i);
    }
  });
});
