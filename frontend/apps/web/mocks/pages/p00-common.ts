import { UPLOADED_IMAGES } from '../fixtures/uploads';
import type { Session } from '@/lib/auth/session';
import { SITEMAP } from '@/lib/policy';
import type { SitemapItem } from '@/lib/seo/sitemap';

import { del, fail, get, newId, post, type MockRoute } from '../core/define';
import { JOB_CATEGORIES, TECH_TAGS } from '../fixtures/tech';
import { DEVELOPERS, findUserById, type UserBrief } from '../fixtures/users';
import { POSTS } from '../fixtures/posts';
import { RECRUITS } from '../fixtures/recruits';

/** 00 foundation mocks: Auth / Catalog / Upload / Moderation (+ Github webhook / Sitemap as added) */

// Page 06 reference: three blocked accounts shown in the settings capture.
const blockedUsers: UserBrief[] = [
  { id: 201, login: 'junhorang', name: '이준호', avatarUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=96&h=96&q=80', userType: 'DEVELOPER', jobStatus: 'OFF' },
  { id: 202, login: 'hanyun123', name: '한윤수', avatarUrl: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=96&h=96&q=80', userType: 'DEVELOPER', jobStatus: 'OFF' },
  { id: 203, login: 'mzcc77', name: '김민지', avatarUrl: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=96&h=96&q=80', userType: 'DEVELOPER', jobStatus: 'OFF' },
];
const blockedIds = new Set<number>(blockedUsers.map(({ id }) => id));

export const isBlocked = (userId: number) => blockedIds.has(userId);

export const routes: MockRoute[] = [
  get('/api/v1/user/me', ({ viewer }): Session => {
    const me = viewer.me!;
    return {
      userId: me.id,
      login: me.login,
      userType: me.userType,
      isAdmin: me.isAdmin,
      status: 'ACTIVE',
      onboarded: viewer.onboarded,
      suspendedUntil: null,
      avatarUrl: me.avatarUrl ?? null,
    };
  }),
  post('/api/v1/public/auth/refresh', () => undefined),

  get('/api/v1/public/tech-tags', () => TECH_TAGS),
  get('/api/v1/public/job-categories', () => JOB_CATEGORIES),

  // Presigned upload: the mock skips the PUT (see features/image-upload/upload-image.ts)
  post('/api/v1/user/uploads', () => {
    const fileId = String(newId());
    return { fileId, uploadUrl: `mock://upload/${fileId}` };
  }),
  post('/api/v1/user/uploads/:fileId/complete', ({ params }) => {
    const url = `/mock/cover-${(Number(params.fileId) % 3) + 1}.svg`;
    UPLOADED_IMAGES.set(params.fileId, url);
    return { fileId: params.fileId, url };
  }),

  post('/api/v1/user/reports', () => undefined),

  get('/api/v1/user/me/blocks', () =>
    [...blockedIds].flatMap((id) => {
      const user = blockedUsers.find((blocked) => blocked.id === id) ?? findUserById(id);
      return user ? [{ user, blockedAt: new Date().toISOString() }] : [];
    }),
  ),
  post('/api/v1/user/blocks', ({ body }) => {
    const userId = Number(body.userId);
    if (
      !DEVELOPERS.some((user) => user.id === userId) &&
      !findUserById(userId) &&
      !blockedUsers.some((user) => user.id === userId)
    ) {
      fail(404, 'NOT_FOUND', '사용자를 찾을 수 없어요');
    }
    blockedIds.add(userId);
    return undefined;
  }),
  del('/api/v1/user/blocks/:userId', ({ params }) => {
    blockedIds.delete(Number(params.userId));
    return undefined;
  }),

  // WBS 00: the same kind/page/items contract as Spring, including URLs and empty trailing pages.
  get('/api/v1/public/sitemap/:kind', ({ params, query }) => {
    const page = Number(query.get('page') ?? '1');
    if (!Number.isInteger(page) || page < 1 || page > 10_000)
      fail(400, 'VALIDATION_ERROR', '페이지 값이 올바르지 않아요');
    let items: SitemapItem[];
    switch (params.kind) {
      case 'users':
        items = DEVELOPERS.map((user) => ({
          id: user.id,
          url: `/user/${encodeURIComponent(user.login)}`,
          updatedAt: user.joinedAt,
        }));
        break;
      case 'posts':
        items = POSTS.filter((post) => post.visibility === 'VISIBLE').map((post) => ({
          id: post.id,
          url: `/posts/${post.id}`,
          updatedAt: post.editedAt ?? post.createdAt,
        }));
        break;
      case 'recruits':
        items = RECRUITS.filter((post) => post.status === 'OPEN').map((post) => ({
          id: post.id,
          url: `/recruits/${post.id}`,
          updatedAt: post.createdAt,
        }));
        break;
      default:
        return fail(400, 'VALIDATION_ERROR', '지원하지 않는 sitemap 종류예요');
    }
    const start = (page - 1) * SITEMAP.pageSize;
    return {
      kind: params.kind,
      page,
      items: items.sort((a, b) => a.id - b.id).slice(start, start + SITEMAP.pageSize),
    };
  }),
];
