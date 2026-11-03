import { sitemapEntries, staticSitemap } from './sitemap';

describe('public sitemap entries', () => {
  const updatedAt = '2026-11-03T00:00:00Z';
  beforeEach(() => vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://linker.test'));
  afterEach(() => vi.unstubAllEnvs());

  it('canonicalizes public entries and preserves their modification dates', () => {
    expect(
      sitemapEntries('posts', [{ id: 1, url: '/posts/1?overlay=report#title', updatedAt }]),
    ).toEqual([{ url: 'https://linker.test/posts/1', lastModified: updatedAt }]);
    expect(staticSitemap().map((entry) => entry.url)).toContain(
      'https://linker.test/legal/privacy',
    );
    expect(staticSitemap().some((entry) => /workspace|admin|settings/.test(entry.url))).toBe(false);
  });

  it.each(['https://evil.test/posts/1', '/admin/reports', '/recruits/1'])(
    'rejects foreign or unrelated URLs: %s',
    (url) => {
      expect(() => sitemapEntries('posts', [{ id: 1, url, updatedAt }])).toThrow(
        'Invalid posts sitemap URL',
      );
    },
  );
});
