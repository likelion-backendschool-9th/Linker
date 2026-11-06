import {
  dateOnly,
  daysAgo,
  del,
  fail,
  get,
  patch,
  put,
  post,
  type MockRoute,
} from '../core/define';
import { POSTS, postCard } from '../fixtures/posts';
import { TEAM_MEMBERS, TEAMS } from '../fixtures/teams';
import { ALL_USERS, brief, findUser, ME, type MockUser } from '../fixtures/users';
import { isBlocked } from './p00-common';

/** 04 Profile: `AccountController` (+ recruiter job ad, `[Included]`) */

const following = new Set<number>([2, 4]);
let pinnedPostIds: number[] = [1];

// One recruiter job ad, ACTIVE (04 POL-H-7)
const ad = {
  id: 1,
  status: 'ACTIVE' as 'ACTIVE' | 'PAUSED' | 'ENDED' | 'HIDDEN',
  jobCategory: 'FRONTEND',
  title: '[넥스트랩] 프론트엔드 개발자 (React/Next.js)',
  url: 'https://www.wanted.co.kr/wd/12345',
  closesOn: dateOnly(21),
  subscribed: true,
};

function profileOf(target: MockUser, viewerId: number | null, viewerRole: string) {
  const isMe = viewerId === target.id;
  const isRecruiterViewer = viewerRole === 'recruiter';
  return {
    ...brief(target),
    githubUrl: `https://github.com/${target.login}`,
    // Header layout depends on the member type (04 ch. 3)
    kind: target.userType,
    bio: target.bio,
    blogUrl: target.blogUrl,
    techStack: target.techStack,
    lookingForTeam: target.lookingForTeam,
    // "OPEN" is only for recruiters; everyone else sees OFF unless SEEKING (04 job-seeking table)
    jobStatus:
      target.jobStatus === 'OPEN' && !isRecruiterViewer && !isMe ? 'OFF' : target.jobStatus,
    followerCount: target.followerCount,
    followingCount: target.followingCount,
    completion: target.completion,
    joinedAt: target.joinedAt,
    isMe,
    isFollowing: viewerId ? following.has(target.id) : false,
    isBlockedByMe: isBlocked(target.id),
    // Set when the viewer arrived through an old GitHub login (90-day redirect)
    redirectedFrom: null as string | null,
    // Recruiter header
    company: target.company ?? null,
    jobTitle: target.jobTitle ?? null,
    companyEmailDomain: target.companyEmailDomain ?? null,
    websiteUrl: target.websiteUrl ?? null,
    pinnedPostIds: isMe
      ? pinnedPostIds
      : POSTS.filter((p) => p.author.id === target.id)
          .slice(0, 1)
          .map((p) => p.id),
  };
}

function userOr404(login: string) {
  const user = findUser(login);
  if (!user) fail(404, 'NOT_FOUND', '삭제되었거나 볼 수 없는 콘텐츠예요');
  return user;
}

/** Deterministic pseudo-random counts so the calendar looks the same on every render */
export function contributionsFor(month: string) {
  const [year, mon] = month.split('-').map(Number) as [number, number];
  const last = new Date(year, mon, 0).getDate();
  return Array.from({ length: last }, (_, index) => {
    const day = index + 1;
    const count = (day * 7 + mon * 3) % 5 === 0 ? 0 : (day * 13 + mon) % 9;
    return { date: `${month}-${String(day).padStart(2, '0')}`, count };
  });
}

const peopleList = (excludeId: number) =>
  ALL_USERS.filter((user) => user.userType === 'DEVELOPER' && user.id !== excludeId)
    .slice(0, 5)
    .map((user) => ({ user: brief(user), isFollowing: following.has(user.id) }));

export const routes: MockRoute[] = [
  get('/api/v1/public/users/:login', ({ params, viewer }) =>
    profileOf(userOr404(params.login), viewer.me?.id ?? null, viewer.role),
  ),
  get('/api/v1/user/users/:login/followers', ({ params }) => ({
    items: peopleList(userOr404(params.login).id),
    nextCursor: null,
  })),
  get('/api/v1/user/users/:login/followings', ({ params }) => ({
    items: peopleList(userOr404(params.login).id),
    nextCursor: null,
  })),
  post(
    '/api/v1/user/users/:login/follow',
    ({ params }) => {
      const target = userOr404(params.login);
      if (target.userType === 'RECRUITER')
        fail(403, 'FORBIDDEN', '채용 담당자는 팔로우할 수 없어요');
      following.add(target.id);
      return undefined;
    },
    { only: 'developer' },
  ),
  del(
    '/api/v1/user/users/:login/follow',
    ({ params }) => {
      following.delete(userOr404(params.login).id);
      return undefined;
    },
    { only: 'developer' },
  ),

  get('/api/v1/public/users/:login/contributions', ({ query }) => {
    const month = query.get('month') ?? new Date().toISOString().slice(0, 7);
    return { month, days: contributionsFor(month), asOf: daysAgo(0) };
  }),
  get('/api/v1/public/users/:login/posts', ({ params }) => {
    const target = userOr404(params.login);
    const own = POSTS.filter((post) => post.author.id === target.id);
    const pinned = target.id === ME.id ? pinnedPostIds : [];
    const ordered = [...own].sort(
      (a, b) => Number(pinned.includes(b.id)) - Number(pinned.includes(a.id)),
    );
    return {
      items: ordered.map((post) => ({ ...postCard(post), pinned: pinned.includes(post.id) })),
    };
  }),
  get('/api/v1/public/users/:login/teams', ({ params }) => {
    const target = userOr404(params.login);
    return {
      items: TEAMS.filter((team) => TEAM_MEMBERS[team.id]?.some((m) => m.user.id === target.id))
        .filter((team) => team.status === 'ACTIVE' || team.status === 'COMPLETED')
        .map(({ id, name, orgAvatarUrl, status }) => ({ id, name, orgAvatarUrl, status })),
    };
  }),
  put(
    '/api/v1/user/me/pinned-posts',
    ({ body }) => {
      pinnedPostIds = (body.postIds as number[] | undefined) ?? [];
      return undefined;
    },
    { only: 'developer' },
  ),

  // Recruiter job ad (`[Included]`)
  get('/api/v1/recruiter/me/ad', () => ad),
  put('/api/v1/recruiter/me/ad', ({ body }) => {
    Object.assign(ad, {
      jobCategory: body.jobCategory ?? ad.jobCategory,
      title: body.title ?? ad.title,
      url: body.url ?? ad.url,
      closesOn: body.closesOn ?? ad.closesOn,
    });
    return ad;
  }),
  patch('/api/v1/recruiter/me/ad/status', ({ body }) => {
    ad.status = body.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE';
    return ad;
  }),
];
