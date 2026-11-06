import type { SitemapPage } from '@/lib/seo/sitemap';

import { POSTS } from './fixtures/posts';
import { RECRUITS } from './fixtures/recruits';
import { DEVELOPERS } from './fixtures/users';
import { mockFetch } from './mock-fetch';

describe('foundation sitemap mock contract', () => {
  it('returns developer profile URLs and no recruiter profile', async () => {
    const page = await mockFetch<SitemapPage>('/api/v1/public/sitemap/users?page=1');
    expect(page).toMatchObject({ kind: 'users', page: 1 });
    expect(page.items.map((item) => item.id)).toEqual(DEVELOPERS.map((user) => user.id));
    expect(page.items.every((item) => item.url.startsWith('/users/') && item.updatedAt)).toBe(true);
    expect((await mockFetch<SitemapPage>('/api/v1/public/sitemap/users?page=2')).items).toEqual([]);
  });

  it('excludes hidden posts and closed recruitment posts', async () => {
    const posts = await mockFetch<SitemapPage>('/api/v1/public/sitemap/posts?page=1');
    const recruits = await mockFetch<SitemapPage>('/api/v1/public/sitemap/recruits?page=1');
    expect(posts.items.map((item) => item.id)).toEqual(
      POSTS.filter((post) => post.visibility === 'VISIBLE')
        .map((post) => post.id)
        .sort((a, b) => a - b),
    );
    expect(recruits.items.map((item) => item.id)).toEqual(
      RECRUITS.filter((post) => post.status === 'OPEN')
        .map((post) => post.id)
        .sort((a, b) => a - b),
    );
  });
});
