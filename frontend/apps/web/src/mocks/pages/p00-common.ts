import { UPLOADED_IMAGES } from '../fixtures/uploads';
import type { Session } from '@/lib/auth/session';

import { del, fail, get, newId, post, type MockRoute } from '../core/define';
import { JOB_CATEGORIES, TECH_TAGS } from '../fixtures/tech';
import { brief, DEVELOPERS, findUserById } from '../fixtures/users';

/** 00 foundation mocks: Auth / Catalog / Upload / Moderation (+ Github webhook / Sitemap as added) */

// Blocked user ids for the logged-in user; starts with one so the settings list isn't empty
const blockedIds = new Set<number>([7]);

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
      const user = findUserById(id);
      return user ? [{ user: brief(user), blockedAt: new Date().toISOString() }] : [];
    }),
  ),
  post('/api/v1/user/blocks', ({ body }) => {
    const userId = Number(body.userId);
    if (!DEVELOPERS.some((user) => user.id === userId) && !findUserById(userId)) {
      fail(404, 'NOT_FOUND', '사용자를 찾을 수 없어요');
    }
    blockedIds.add(userId);
    return undefined;
  }),
  del('/api/v1/user/blocks/:userId', ({ params }) => {
    blockedIds.delete(Number(params.userId));
    return undefined;
  }),

  // Search-indexable lists (B, D10): ids only
  get('/api/v1/public/sitemap/:kind', ({ params }) => ({
    kind: params.kind,
    items: [{ id: 1, updatedAt: new Date().toISOString() }],
  })),
];
