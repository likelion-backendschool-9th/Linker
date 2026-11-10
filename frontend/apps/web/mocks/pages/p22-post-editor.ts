import { fail, get, newId, post, put, type MockRoute } from '../core/define';
import { findPost, POSTS, type MockPost, type MockRepoCard } from '../fixtures/posts';
import { brief, ME } from '../fixtures/users';

/** 22 Write/edit project post: `PostController`. One post per repo (POL-P-1). */

const PHOTO_LIMIT = 5; // Pro 10

const repos = [
  {
    repoId: 11,
    fullName: 'linker-hack/linker-web',
    language: 'TypeScript',
    stars: 28,
    isFork: false,
    teamId: 1,
  },
  {
    repoId: 12,
    fullName: 'linker-hack/linker-api',
    language: 'Java',
    stars: 12,
    isFork: false,
    teamId: 1,
  },
  {
    repoId: 21,
    fullName: 'oss-study-kr/study-notes',
    language: 'Markdown',
    stars: 4,
    isFork: false,
    teamId: 2,
  },
  {
    repoId: 41,
    fullName: 'seojun-han/dotfiles',
    language: 'Shell',
    stars: 2,
    isFork: false,
    teamId: null,
  },
  {
    repoId: 42,
    fullName: 'seojun-han/react-fork',
    language: 'JavaScript',
    stars: 0,
    isFork: true,
    parentFullName: 'facebook/react',
    teamId: null,
  },
];

function ownPost(id: string) {
  const item = findPost(id);
  if (!item) fail(404, 'NOT_FOUND', '삭제되었거나 볼 수 없는 콘텐츠예요');
  if (item.author.id !== ME.id) fail(403, 'FORBIDDEN', '내 게시물이 아니에요');
  return item;
}

function applyForm(item: MockPost, body: Record<string, unknown>) {
  const photos = (body.photos as { url: string }[] | undefined)?.map((p) => p.url);
  if (photos && photos.length > PHOTO_LIMIT) {
    fail(403, 'PLAN_LIMIT', '사진은 5장까지 올릴 수 있어요. Pro로 10장까지 늘릴 수 있어요.', {
      reason: 'POST_PHOTOS',
    });
  }
  // Nullable fields: a sent `null` clears them, a missing key keeps the old value
  const nullable = <K extends keyof MockPost>(key: K) =>
    (key in body ? body[key] : item[key]) as MockPost[K];
  Object.assign(item, {
    intro: String(body.intro ?? item.intro),
    body: String(body.body ?? item.body),
    myRole: nullable('myRole'),
    demoLinks: (body.demoLinks as string[] | undefined) ?? item.demoLinks,
    period: nullable('period'),
    teamSize: nullable('teamSize'),
    tags: (body.tags as string[] | undefined) ?? item.tags,
    photos: photos ?? item.photos,
  });
}

export const routes: MockRoute[] = [
  get(
    '/api/v1/user/post-editor/repos',
    ({ query }) => {
      const q = (query.get('q') ?? '').toLowerCase();
      const teamId = query.get('teamId');
      return {
        items: repos
          .filter((r) => !q || r.fullName.toLowerCase().includes(q))
          .filter((r) => !teamId || String(r.teamId) === teamId)
          .map((r) => ({
            ...r,
            // Already posted: one post per repo (POL-P-1)
            alreadyPosted: POSTS.some((p) => p.repo.repoId === r.repoId),
          })),
      };
    },
    { only: 'developer' },
  ),
  get(
    '/api/v1/user/post-editor/repos/:repoId/summary',
    ({ params }) => {
      const repo = repos.find((r) => r.repoId === Number(params.repoId));
      if (!repo) fail(404, 'NOT_FOUND', '레포를 찾지 못했어요');
      return {
        repoId: repo.repoId,
        fullName: repo.fullName,
        description: '레포 설명이 여기에 들어가요.',
        language: repo.language,
        stars: repo.stars,
        forks: 1,
        isFork: repo.isFork,
        parentFullName: 'parentFullName' in repo ? repo.parentFullName : null,
        // Proposal beyond WBS: the viewer's photo cap (5, Pro 10) so the picker can prompt early
        photoLimit: PHOTO_LIMIT,
        // 0 also when the commit email isn't registered (POL-P-2 exceptions)
        authorCommitCount: repo.repoId === 12 ? 0 : 84,
        handledIssueCount: 17,
      };
    },
    { only: 'developer' },
  ),
  post(
    '/api/v1/user/posts',
    ({ body }) => {
      const repo = repos.find((r) => r.repoId === Number(body.repoId));
      if (!repo) fail(400, 'REPO_REQUIRED', '레포를 골라 주세요');
      if (POSTS.some((p) => p.repo.repoId === repo.repoId)) {
        fail(409, 'REPO_ALREADY_POSTED', '이미 작업물로 올린 레포예요');
      }
      const card: MockRepoCard = {
        repoId: repo.repoId,
        fullName: repo.fullName,
        description: '레포 설명이 여기에 들어가요.',
        language: repo.language,
        stars: repo.stars,
        forks: 1,
        isFork: repo.isFork,
        state: 'PUBLIC',
        authorCommitCount: 84,
        handledIssueCount: 17,
      };
      const item: MockPost = {
        id: newId(),
        author: brief(ME),
        intro: '',
        body: '',
        repo: card,
        photos: [],
        myRole: null,
        demoLinks: [],
        period: null,
        teamSize: null,
        tags: [],
        likeCount: 0,
        commentCount: 0,
        viewCount: 0,
        visibility: 'VISIBLE',
        createdAt: new Date().toISOString(),
        editedAt: null,
      };
      applyForm(item, body);
      POSTS.unshift(item);
      return { id: item.id };
    },
    { only: 'developer' },
  ),
  get('/api/v1/user/posts/:postId/edit-form', ({ params }) => {
    const item = ownPost(params.postId!);
    return {
      ...item,
      photos: item.photos.map((url, index) => ({ fileId: `post-${item.id}-${index + 1}`, url })),
      photoLimit: PHOTO_LIMIT,
    };
  }),
  put('/api/v1/user/posts/:postId', ({ params, body }) => {
    const item = ownPost(params.postId!);
    applyForm(item, body);
    item.editedAt = new Date().toISOString();
    return { id: item.id };
  }),
];
