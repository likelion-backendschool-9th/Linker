import { dateOnly, del, get, paginate, post, type MockRoute } from '../core/define';
import { POSTS, postCard } from '../fixtures/posts';
import { brief, OTHERS } from '../fixtures/users';

/** 24 Home feed: `FeedController`. Ad items follow docs/development/03-frontend-blueprint.md ch. 15 (`type: 'AD'`). */

type WhyShown = string | null;

const WHY: Record<number, WhyShown> = {
  2: '이번 주 인기',
  4: 'React를 쓰는 사람들의 인기 글',
  3: '이도윤님이 좋아해요',
  5: '박서연님과 아는 사이',
};

const ad = {
  type: 'AD' as const,
  adId: 1,
  companyName: '넥스트랩',
  title: '[넥스트랩] 프론트엔드 개발자 (React/Next.js)',
  jobCategory: 'FRONTEND',
  closesOn: dateOnly(21),
};

const dismissedAds = new Set<number>();

export const routes: MockRoute[] = [
  get('/api/v1/public/feed', ({ query, viewer }) => {
    const offersOnly = query.get('offersOnly') === 'true';
    const logged = Boolean(viewer.me);
    let posts = [...POSTS].sort(
      (a, b) => b.likeCount - a.likeCount || b.createdAt.localeCompare(a.createdAt),
    );
    // Recruiter toggle "제안 받는 개발자만" (Only developers open to offers)
    if (offersOnly) posts = posts.filter((p) => p.author.jobStatus !== 'OFF');

    const rows = posts.map((post) => ({
      type: 'POST' as const,
      post: postCard(post),
      // Guests only get "이번 주 인기" / "새로 올라온 작업물" (POL-A-9)
      whyShown: logged
        ? (WHY[post.id] ?? '새로 올라온 작업물')
        : post.likeCount > 40
          ? '이번 주 인기'
          : '새로 올라온 작업물',
    }));

    // One ad per 10 posts, never on the first screen; logged-in developers with matching categories only
    const withAd =
      viewer.role === 'developer' || viewer.role === 'operator'
        ? dismissedAds.has(ad.adId)
          ? rows
          : [...rows.slice(0, 4), ad, ...rows.slice(4)]
        : rows;

    return paginate(withAd, query, 10);
  }),
  post('/api/v1/user/feed/seen', () => undefined),
  // Empty feed right after sign-up: 5 developers by my stack (POL-P edge cases)
  get('/api/v1/user/feed/recommended-users', () => ({
    items: OTHERS.slice(0, 5).map((user) => ({ user: brief(user), techStack: user.techStack })),
  })),

  // `[Included]` Job ads
  post('/api/v1/user/ads/:adId/click', () => ({ url: 'https://www.wanted.co.kr/wd/12345' }), {
    only: 'developer',
  }),
  post(
    '/api/v1/user/ads/:adId/dismiss',
    ({ params }) => {
      dismissedAds.add(Number(params.adId));
      return undefined;
    },
    { only: 'developer' },
  ),
  del(
    '/api/v1/user/ads/:adId/dismiss',
    ({ params }) => {
      dismissedAds.delete(Number(params.adId));
      return undefined;
    },
    { only: 'developer' },
  ),
  post(
    '/api/v1/user/ads/:adId/hide',
    ({ params }) => {
      dismissedAds.add(Number(params.adId));
      return undefined;
    },
    { only: 'developer' },
  ),
];
