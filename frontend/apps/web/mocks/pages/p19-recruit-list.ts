import { del, fail, get, paginate, type MockRoute } from '../core/define';
import { APPLICATIONS, RECRUITS, recruitCard } from '../fixtures/recruits';
import { ME } from '../fixtures/users';

/** 19 Recruit post list: `RecruitmentController` */

export const routes: MockRoute[] = [
  // Open posts only; filters role (RecruitRoleKey) / tech / mode (online, offline, hybrid) / sort (NEWEST, DEADLINE)
  get('/api/v1/public/recruits', ({ query }) => {
    const role = query.get('role');
    const tech = query.get('tech');
    const mode = query.get('mode');
    const sort = query.get('sort') ?? 'NEWEST';
    const items = RECRUITS.filter((item) => item.status === 'OPEN')
      .filter((item) => !role || item.roles.some((r) => r.role === role))
      .filter((item) => !tech || item.techTags.includes(tech))
      .filter((item) => !mode || item.format === mode)
      .sort((a, b) =>
        sort === 'DEADLINE'
          ? a.deadline.localeCompare(b.deadline)
          : b.createdAt.localeCompare(a.createdAt),
      )
      .map(recruitCard);
    return paginate(items, query);
  }),
  get(
    '/api/v1/user/me/recruits',
    ({ query }) =>
      paginate(RECRUITS.filter((item) => item.author.id === ME.id).map(recruitCard), query),
    { only: 'developer' },
  ),
  get(
    '/api/v1/user/me/applications',
    ({ query }) => {
      const status = query.get('status');
      const items = APPLICATIONS.filter((a) => a.applicant.id === ME.id && a.status !== 'CANCELLED')
        .filter((a) => !status || a.status === status)
        .map((a) => {
          const recruit = RECRUITS.find((r) => r.id === a.recruitId)!;
          return {
            id: a.id,
            status: a.status,
            appliedAt: a.appliedAt,
            roleName: recruit.roles.find((r) => r.id === a.roleId)?.name ?? '',
            recruit: recruitCard(recruit),
            // Accepted → shortcut to team chat (POL-R-4)
            teamChatRoomId: a.status === 'ACCEPTED' ? 1 : null,
          };
        });
      return paginate(items, query);
    },
    { only: 'developer' },
  ),
  // Only while pending (POL-R-3). Borrowed by 21.
  del(
    '/api/v1/user/me/applications/:applicationId',
    ({ params }) => {
      const application = APPLICATIONS.find((a) => a.id === Number(params.applicationId));
      if (!application) fail(404, 'NOT_FOUND', '지원 내역을 찾지 못했어요');
      if (application.status !== 'PENDING')
        fail(409, 'NOT_PENDING', '검토 중인 지원만 취소할 수 있어요');
      application.status = 'CANCELLED';
      return undefined;
    },
    { only: 'developer' },
  ),
];
