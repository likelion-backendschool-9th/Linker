import { SITEMAP } from '@/lib/policy';

import { fetchPublicCached } from './public-cached';
import { pagedSitemap, sitemapIds } from './sitemap';

vi.mock('server-only', () => ({}));
vi.mock('./public-cached', () => ({ fetchPublicCached: vi.fn() }));

describe('sitemap API pagination', () => {
  const item = { id: 1, url: '/posts/1', updatedAt: '2026-11-03T00:00:00Z' };
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'false');
    vi.mocked(fetchPublicCached).mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('discovers the next partition after a full 50,000 URL page', async () => {
    vi.mocked(fetchPublicCached)
      .mockResolvedValueOnce({ kind: 'posts', page: 1, items: Array(SITEMAP.pageSize).fill(item) })
      .mockResolvedValueOnce({ kind: 'posts', page: 2, items: [item] });
    await expect(sitemapIds('posts')).resolves.toEqual([{ id: 0 }, { id: 1 }]);
    expect(fetchPublicCached).toHaveBeenLastCalledWith('/api/v1/public/sitemap/posts?page=2', {
      revalidate: 86400,
      tags: ['sitemap:posts'],
    });
  });

  it('keeps an empty first partition without inventing a count endpoint', async () => {
    vi.mocked(fetchPublicCached).mockResolvedValue({ kind: 'recruits', page: 1, items: [] });
    await expect(sitemapIds('recruits')).resolves.toEqual([{ id: 0 }]);
    expect(fetchPublicCached).toHaveBeenCalledTimes(1);
  });

  it('maps zero-based sitemap IDs to the existing one-based API', async () => {
    vi.mocked(fetchPublicCached).mockResolvedValue({ kind: 'posts', page: 3, items: [item] });
    await expect(pagedSitemap('posts', '2')).resolves.toMatchObject([
      { lastModified: item.updatedAt },
    ]);
    expect(fetchPublicCached).toHaveBeenCalledWith(
      '/api/v1/public/sitemap/posts?page=3',
      expect.anything(),
    );
  });

  it('fails visibly for a mismatched API response', async () => {
    vi.mocked(fetchPublicCached).mockResolvedValue({ kind: 'users', page: 1, items: [] });
    await expect(sitemapIds('posts')).rejects.toThrow('Mismatched sitemap page');
  });

  it('defers partition discovery during a production build', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    await expect(sitemapIds('posts')).resolves.toEqual([]);
    expect(fetchPublicCached).not.toHaveBeenCalled();
  });
});
