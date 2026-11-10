import { fail, get, newId, post, type MockRoute } from '../core/define';
import { APPLICATIONS, findRecruit, recruitCard, type MockApplication } from '../fixtures/recruits';
import { TEAM_MEMBERS, TEAMS } from '../fixtures/teams';
import { brief, ME, findUserById } from '../fixtures/users';

/** 21 Recruit post detail: `RecruitmentController` (apply and manage applicants) */

function recruitOr404(id: string) {
  const item = findRecruit(id);
  if (!item) fail(404, 'NOT_FOUND', '삭제되었거나 볼 수 없는 콘텐츠예요');
  return item;
}

function requireAuthor(id: string, viewerId: number) {
  const item = recruitOr404(id);
  if (item.author.id !== viewerId) fail(403, 'FORBIDDEN', '모집 글 작성자만 볼 수 있어요');
  return item;
}

const applicationOr404 = (id: string) => {
  const application = APPLICATIONS.find((a) => a.id === Number(id));
  if (!application) fail(404, 'NOT_FOUND', '지원 내역을 찾지 못했어요');
  return application;
};

export const routes: MockRoute[] = [
  get('/api/v1/public/recruits/:recruitId', ({ params, viewer }) => {
    const item = recruitOr404(params.recruitId!);
    const mine = viewer.me
      ? APPLICATIONS.find(
          (a) =>
            a.recruitId === item.id && a.applicant.id === viewer.me!.id && a.status !== 'CANCELLED',
        )
      : undefined;
    const team = TEAMS.find((t) => t.id === item.teamId);
    const members = item.teamId ? (TEAM_MEMBERS[item.teamId] ?? []) : [];
    const teamMembers = members.length
      ? members.map((member) => ({
          ...member.user,
          teamRole: member.role,
          isAuthor: member.user.id === item.author.id,
        }))
      : [{ ...item.author, teamRole: 'OWNER' as const, isAuthor: true }];
    return {
      ...recruitCard(item),
      intro: item.intro,
      duration: item.duration,
      teamName: team?.name ?? null,
      authorCard: { ...item.author, bio: findUserById(item.author.id)?.bio ?? null },
      // Figma 21 "팀원 프로필"; author alone when the post has no team yet
      teamMembers,
      // Logged in: my application, already a member, am I the author
      isAuthor: viewer.me?.id === item.author.id,
      isTeamMember: Boolean(
        team && viewer.me && team.id === 1 && viewer.me.id === ME.id && item.teamId === 1,
      ),
      myApplication: mine
        ? {
            id: mine.id,
            status: mine.status,
            roleId: mine.roleId,
            // Accepted → shortcut to team chat (POL-R-4)
            teamChatRoomId: mine.status === 'ACCEPTED' ? 1 : null,
          }
        : null,
      applicantCount: APPLICATIONS.filter((a) => a.recruitId === item.id && a.status === 'PENDING')
        .length,
    };
  }),
  post(
    '/api/v1/user/recruits/:recruitId/applications',
    ({ params, body, viewer }) => {
      const item = recruitOr404(params.recruitId!);
      const me = viewer.me!;
      if (item.author.id === me.id) fail(403, 'FORBIDDEN', '내 모집 글에는 지원할 수 없어요');
      if (item.status === 'CLOSED') fail(409, 'RECRUIT_CLOSED', '모집이 끝났어요');
      if (
        APPLICATIONS.some(
          (a) => a.recruitId === item.id && a.applicant.id === me.id && a.status === 'PENDING',
        )
      ) {
        fail(409, 'ALREADY_APPLIED', '이미 지원한 모집 글이에요');
      }
      const application: MockApplication = {
        id: newId(),
        recruitId: item.id,
        applicant: brief(me),
        roleId: Number(body.roleId),
        message: '',
        status: 'PENDING',
        appliedAt: new Date().toISOString(),
        daysLeft: 14,
      };
      APPLICATIONS.push(application);
      return { id: application.id, status: application.status };
    },
    { only: 'developer' },
  ),
  // Author only: applicants tab with days left until the 14-day expiry
  get('/api/v1/user/recruits/:recruitId/applications', ({ params, query, viewer }) => {
    const item = requireAuthor(params.recruitId!, viewer.me!.id);
    const roleId = query.get('roleId');
    return {
      roles: item.roles,
      items: APPLICATIONS.filter((a) => a.recruitId === item.id && a.status !== 'CANCELLED')
        .filter((a) => !roleId || a.roleId === Number(roleId))
        .map((a) => ({
          id: a.id,
          applicant: a.applicant,
          roleId: a.roleId,
          roleName: item.roles.find((r) => r.id === a.roleId)?.name ?? '',
          status: a.status,
          appliedAt: a.appliedAt,
          daysLeft: a.daysLeft,
        })),
    };
  }),
  get('/api/v1/user/recruits/:recruitId/applications/:applicationId', ({ params, viewer }) => {
    requireAuthor(params.recruitId!, viewer.me!.id);
    const application = applicationOr404(params.applicationId!);
    return {
      id: application.id,
      status: application.status,
      appliedAt: application.appliedAt,
      applicant: application.applicant,
      techStack: [] as string[],
      completion: { projectCount: 0, issueCompletionRate: 0 },
      contributions: [] as { date: string; count: number }[],
      posts: [] as { id: number; intro: string; repoFullName: string }[],
    };
  }),
  post(
    '/api/v1/user/recruits/:recruitId/applications/:applicationId/accept',
    ({ params, body, viewer }) => {
      const item = requireAuthor(params.recruitId!, viewer.me!.id);
      const application = applicationOr404(params.applicationId!);
      const role = item.roles.find((r) => r.id === application.roleId);
      if (!item.teamId) fail(409, 'TEAM_REQUIRED', '팀을 먼저 만들어야 수락할 수 있어요');
      if (role && role.filled >= role.headcount) {
        if (body.increaseHeadcount === true && role.headcount < 10) {
          // Flex-only: free teams hit PLAN_LIMIT → shared Flex sheet
          const team = TEAMS.find((entry) => entry.id === item.teamId);
          if (!team || team.plan !== 'FLEX') {
            fail(403, 'PLAN_LIMIT', '역할 인원을 늘리려면 Flex 구독이 필요해요.', {
              reason: 'ROLE_HEADCOUNT',
            });
          }
          role.headcount += 1;
        } else {
          fail(409, 'ROLE_FULL', '이 역할은 이미 다 찼어요', {
            roleId: role.id,
            headcount: role.headcount,
          });
        }
      }
      application.status = 'ACCEPTED';
      if (role) role.filled += 1;
      return { teamId: item.teamId, chatRoomId: 1, needsGithubInvite: true };
    },
  ),
  // The reason stays internal; the applicant only sees fixed copy (POL-R-4)
  post(
    '/api/v1/user/recruits/:recruitId/applications/:applicationId/reject',
    ({ params, viewer }) => {
      requireAuthor(params.recruitId!, viewer.me!.id);
      applicationOr404(params.applicationId!).status = 'REJECTED';
      return undefined;
    },
  ),
];
