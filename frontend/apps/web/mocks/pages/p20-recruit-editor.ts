import { RECRUIT_ROLE_LABELS, type RecruitRoleKey } from '@/features/recruit/recruit-labels';
import { RECRUIT } from '@/lib/policy';

import { dateOnly, del, fail, get, newId, post, put, type MockRoute } from '../core/define';
import { RECRUITS, type MockRecruit } from '../fixtures/recruits';
import { TEAMS } from '../fixtures/teams';
import { brief, ME } from '../fixtures/users';

/** 20 Write/edit recruit post: `RecruitmentController` */

const OPEN_LIMIT = 3; // Pro 10 (04 POL-R-1)

/** Last allowed deadline: today + 6 calendar months, like the server's `plusMonths` (month end clamps) */
function sixMonthsOn(): string {
  const [year, month, day] = dateOnly(0).split('-').map(Number) as [number, number, number];
  const target = new Date(Date.UTC(year, month - 1 + RECRUIT.deadlineWithinMonths, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Create attempts since the mock started (stands in for the server's daily window) */
let createAttempts = 0;

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
      maxDeadlineDate: sixMonthsOn(),
    }),
    { only: 'developer' },
  ),
  post(
    '/api/v1/user/recruits',
    ({ body }) => {
      // `@RateLimit` runs before anything else and counts every attempt (04 ch. 2: 5/day)
      createAttempts += 1;
      if (createAttempts > RECRUIT.createPerDay) {
        fail(429, 'RATE_LIMITED', '요청이 너무 많아요. 잠시 후 다시 시도해 주세요', {
          retryAfterSeconds: 86_400,
        });
      }
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
  // Same order as the server: author → already open → ROLES_FULL → DEADLINE_PASSED → open cap
  post('/api/v1/user/recruits/:recruitId/reopen', ({ params }) => {
    const item = ownRecruit(params.recruitId!);
    if (item.status === 'OPEN') return undefined;
    if (item.roles.length > 0 && item.roles.every((role) => role.filled >= role.headcount)) {
      fail(409, 'ROLES_FULL', '모집 인원이 모두 찼어요. 인원을 늘린 뒤 다시 열어 주세요.');
    }
    if (item.deadline < dateOnly(0)) {
      fail(409, 'DEADLINE_PASSED', '마감일이 지났어요. 마감일을 바꾼 뒤 다시 열어 주세요.');
    }
    if (openCount() >= OPEN_LIMIT)
      fail(403, 'PLAN_LIMIT', '동시에 모집할 수 있는 글은 3개까지예요.', {
        reason: 'RECRUIT_POSTS',
      });
    item.status = 'OPEN';
    return undefined;
  }),
  del('/api/v1/user/recruits/:recruitId', ({ params }) => {
    const item = ownRecruit(params.recruitId!);
    RECRUITS.splice(RECRUITS.indexOf(item), 1);
    return undefined;
  }),
];
