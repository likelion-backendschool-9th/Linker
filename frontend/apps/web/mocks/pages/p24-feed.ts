import { dateOnly, del, get, paginate, post, type MockRoute } from '../core/define';
import { LIKED_POST_IDS, POSTS, postCard } from '../fixtures/posts';
import { brief, OTHERS } from '../fixtures/users';

/** 24 Home feed: `PostController`. Ad items follow docs/development/03-frontend-blueprint.md ch. 15 (`type: 'AD'`). */

// "추천" matches for the mock developer (POL-P-4): tech stack tag beats job category
const MATCHED: Record<number, string> = {
  4: 'React를 쓰는 사람들의 인기 글',
  2: '프론트엔드 직군의 인기 글',
};

// Stand-in for the server's per-visit shuffle: a fixed, id-based order so pages never repeat
const shuffleKey = (id: number) => (id * 7919) % 101;

const ad = {
  type: 'AD' as const,
  adId: 1,
  companyName: '넥스트랩',
  title: '[넥스트랩] 프론트엔드 개발자 (React/Next.js)',
  jobCategory: 'FRONTEND',
  closesOn: dateOnly(21),
};

const dismissedAds = new Set<number>();

// Card states for Figma 92:249 (liked heart, same set 23 likes into) / 92:259 ("팔로잉"); guests see neither
const FOLLOWING_LOGINS = new Set(OTHERS.slice(1, 3).map((user) => user.login));

export const routes: MockRoute[] = [
  get('/api/v1/public/feed', ({ query, viewer }) => {
    const offersOnly = query.get('offersOnly') === 'true';
    const logged = Boolean(viewer.me);

    // "팔로잉" tab: posts by people I follow, newest first, no ads. Guests and recruiters follow
    // nobody (recruiters can't follow, 04 ch. 2), so they get an empty list.
    if (query.get('tab') === 'following') {
      const following =
        viewer.role === 'developer' || viewer.role === 'operator'
          ? POSTS.filter((p) => FOLLOWING_LOGINS.has(p.author.login))
          : [];
      const rows = [...following]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((post) => ({
          type: 'POST' as const,
          post: {
            ...postCard(post),
            likedByMe: LIKED_POST_IDS.has(post.id),
            author: { ...post.author, isFollowing: true },
          },
          whyShown: null,
        }));
      return paginate(rows, query, 10);
    }
    // "추천": developers and operators get matches first (by likes), then the rest shuffled;
    // guests and recruiters get everything shuffled with no "why shown"
    const matching = viewer.role === 'developer' || viewer.role === 'operator';
    const shuffled = [...POSTS].sort((a, b) => shuffleKey(a.id) - shuffleKey(b.id));
    const matched = matching
      ? POSTS.filter((p) => MATCHED[p.id]).sort((a, b) => b.likeCount - a.likeCount)
      : [];
    let posts = [...matched, ...shuffled.filter((p) => !matched.includes(p))];
    // Recruiter toggle "제안 받는 개발자만" (Only developers open to offers)
    if (offersOnly) posts = posts.filter((p) => p.author.jobStatus !== 'OFF');

    const rows = posts.map((post) => ({
      type: 'POST' as const,
      post: {
        ...postCard(post),
        likedByMe: logged && LIKED_POST_IDS.has(post.id),
        author: { ...post.author, isFollowing: logged && FOLLOWING_LOGINS.has(post.author.login) },
      },
      whyShown: matching ? (MATCHED[post.id] ?? null) : null,
    }));

    // One ad per 10 posts, never on the first screen; logged-in developers with matching categories only
    const withAd = matching
      ? dismissedAds.has(ad.adId)
        ? rows
        : [...rows.slice(0, 4), ad, ...rows.slice(4)]
      : rows;

    return paginate(withAd, query, 10);
  }),
  post('/api/v1/user/feed/seen', () => undefined),
  // Empty "추천" (no visible posts at all): 5 developers by my stack (POL-P edge cases)
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
