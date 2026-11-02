import { RECRUIT_ROLE_LABELS, type RecruitRoleKey } from '@/features/recruit/recruit-labels';

import { dateOnly, del, fail, get, newId, post, put, type MockRoute } from '../core/define';
import { RECRUITS, type MockRecruit } from '../fixtures/recruits';
import { TEAMS } from '../fixtures/teams';
import { brief, ME } from '../fixtures/users';

/** 20 Write/edit recruit post: `RecruitEditorController` */

const OPEN_LIMIT = 3; // Pro 10 (04 POL-R-1)

const openCount = () =>
  RECRUITS.filter((item) => item.author.id === ME.id && item.status === 'OPEN').length;

function ownRecruit(id: string) {
  const item = RECRUITS.find((r) => r.id === Number(id));
  if (!item) fail(404, 'NOT_FOUND', '삭제되었거나 볼 수 없는 콘텐츠예요');
  if (item.author.id !== ME.id) fail(403, 'FORBIDDEN', '내 모집 글이 아니에요');
  return item;
}

function applyForm(item: MockRecruit, body: Record<string, unknown>) {
  const roles =
    (body.roles as { id?: number; role: RecruitRoleKey; headcount: number }[] | undefined) ?? [];
  // Nullable fields: a sent `null` clears them, a missing key keeps the old value
  const nullable = <K extends keyof MockRecruit>(key: K) =>
    (key in body ? body[key] : item[key]) as MockRecruit[K];
  Object.assign(item, {
    title: String(body.title ?? item.title),
    intro: String(body.intro ?? item.intro),
    format: body.format ?? item.format,
    region: nullable('region'),
    goal: nullable('goal'),
    duration: nullable('duration'),
    deadline: String(body.deadline ?? item.deadline),
    techTags: (body.techTags as string[] | undefined) ?? item.techTags,
    teamId: nullable('teamId'),
  });
  if (roles.length) {
    item.roles = roles.map((role) => ({
      id: role.id ?? newId(),
      role: role.role,
      name: RECRUIT_ROLE_LABELS[role.role],
      headcount: role.headcount,
      filled: item.roles.find((r) => r.id === role.id)?.filled ?? 0,
    }));
  }
}

export const routes: MockRoute[] = [
  get(
    '/api/v1/user/recruit-editor/options',
    () => ({
      // Teams I can link: owner / admin (POL-R-1)
      teams: TEAMS.filter((t) => t.myRole !== 'MEMBER' && t.status === 'ACTIVE').map(
        ({ id, name }) => ({ id, name }),
      ),
      openCount: openCount(),
      openLimit: OPEN_LIMIT,
      maxDeadlineDate: dateOnly(60),
    }),
    { only: 'developer' },
  ),
  post(
    '/api/v1/user/recruits',
    ({ body }) => {
      if (openCount() >= OPEN_LIMIT) {
        fail(
          403,
          'PLAN_LIMIT',
          '동시에 모집할 수 있는 글은 3개까지예요. Pro로 10개까지 늘릴 수 있어요.',
          {
            reason: 'RECRUIT_POSTS',
          },
        );
      }
      const item: MockRecruit = {
        id: newId(),
        author: brief(ME),
        teamId: null,
        title: '',
        intro: '',
        format: 'ONLINE',
        region: null,
        goal: null,
        duration: null,
        deadline: dateOnly(14),
        status: 'OPEN',
        techTags: [],
        roles: [],
        createdAt: new Date().toISOString(),
      };
      applyForm(item, body);
      RECRUITS.unshift(item);
      return { id: item.id };
    },
    { only: 'developer' },
  ),
  get('/api/v1/user/recruits/:recruitId/edit-form', ({ params }) => {
    const item = ownRecruit(params.recruitId!);
    return {
      ...item,
      // Roles with applicants can't be removed; headcount can't go below accepted (POL-R edit exceptions)
      lockedRoleIds: item.roles.filter((r) => r.filled > 0).map((r) => r.id),
      minHeadcountByRole: Object.fromEntries(item.roles.map((r) => [r.id, r.filled])),
    };
  }),
  put('/api/v1/user/recruits/:recruitId', ({ params, body }) => {
    applyForm(ownRecruit(params.recruitId!), body);
    return { id: Number(params.recruitId) };
  }),
  post('/api/v1/user/recruits/:recruitId/close', ({ params }) => {
    ownRecruit(params.recruitId!).status = 'CLOSED';
    return undefined;
  }),
  post('/api/v1/user/recruits/:recruitId/reopen', ({ params }) => {
    if (openCount() >= OPEN_LIMIT)
      fail(403, 'PLAN_LIMIT', '동시에 모집할 수 있는 글은 3개까지예요.', {
        reason: 'RECRUIT_POSTS',
      });
    ownRecruit(params.recruitId!).status = 'OPEN';
    return undefined;
  }),
  del('/api/v1/user/recruits/:recruitId', ({ params }) => {
    const item = ownRecruit(params.recruitId!);
    RECRUITS.splice(RECRUITS.indexOf(item), 1);
    return undefined;
  }),
];
