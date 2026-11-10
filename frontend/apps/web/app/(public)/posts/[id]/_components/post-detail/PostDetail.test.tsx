import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import { ApiError } from '@/lib/api/api-error';
import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import type { PostComment, PostDetail as Detail } from '../../_lib/post-detail-queries';
import { PostDetail } from './PostDetail';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);
// Renders the whole page with axe: comfortably fast alone, slower with the suite in parallel
vi.setConfig({ testTimeout: 15_000 });

const author = {
  id: 1,
  login: 'linker',
  name: '김링커',
  avatarUrl: '/mock/avatar.png',
  jobStatus: 'SEEKING' as const,
  isFollowing: false,
};
const base: Detail = {
  id: 1,
  author,
  intro: 'Linker 웹 클라이언트',
  body: '2주 해커톤에서 만들었어요.\n데모: https://linker.example.dev',
  repo: {
    fullName: 'linker-hack/linker-web',
    description: 'Linker 웹',
    language: 'TypeScript',
    stars: 28,
    forks: 4,
    isFork: false,
    state: 'PUBLIC',
    authorCommitCount: 84,
    handledIssueCount: 34,
  },
  photos: ['/mock/cover-1.svg', '/mock/cover-2.svg'],
  myRole: '프론트엔드 개발',
  demoLinks: ['https://linker.example.dev'],
  period: { start: '2026-10', end: null },
  teamSize: 5,
  tags: ['Next.js'],
  likeCount: 42,
  commentCount: 2,
  visibility: 'VISIBLE',
  createdAt: '2026-10-30T00:00:00Z',
  editedAt: '2026-10-31T00:00:00Z',
  isAuthor: false,
  likedByMe: false,
  canSendOffer: false,
};
const comments: PostComment[] = [
  {
    id: 3,
    author: { id: 4, login: 'doyun', name: '이도윤', avatarUrl: '/mock/avatar.png' },
    text: '데모가 깔끔해요.',
    createdAt: '2026-10-31T00:00:00Z',
    editedAt: null,
  },
  {
    id: 5,
    author: { id: 7, login: 'taeyang', name: '정태양', avatarUrl: '/mock/avatar.png' },
    text: '구조가 깔끔해요!',
    createdAt: '2026-10-31T02:00:00Z',
    editedAt: null,
  },
];

let sameRepo: unknown[] = [];

function serve(detail: Detail, like?: () => unknown) {
  fetchMock.mockImplementation(async (url) => {
    if (url.startsWith('/api/v1/public/posts/1/comments')) return { items: comments };
    if (url.startsWith('/api/v1/public/posts/1/same-repo-posts')) return { items: sameRepo };
    if (url.startsWith('/api/v1/public/posts/1')) return detail;
    if (url.endsWith('/likes')) return like?.();
    if (url.endsWith('/comments')) return comments[1];
    return undefined;
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  sameRepo = [];
});

it('shows a guest the whole post and sends reactions to the login prompt', async () => {
  serve(base);
  const user = userEvent.setup();
  const onUrlUpdate = vi.fn();
  const { container } = renderWithProviders(<PostDetail postId="1" />, { onUrlUpdate });

  expect(await screen.findByRole('heading', { name: base.intro })).toBeVisible();
  expect(screen.getByRole('img', { name: 'linker-web 이미지 1' })).toBeVisible();
  expect(screen.getByText('프론트엔드 개발')).toBeVisible();
  expect(screen.getByText('2026.10.30 작성')).toBeVisible();
  expect(screen.getAllByRole('link', { name: /linker\.example\.dev/ }).length).toBeGreaterThan(0);
  expect(await screen.findByRole('article', { name: '정태양' })).toBeVisible();
  expect(screen.getAllByText('2026년 10월 31일')).toHaveLength(2);
  expect(screen.queryByRole('button', { name: /답글/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'README' })).not.toBeInTheDocument();
  expect(await axe(container)).toHaveNoViolations();

  await user.click(screen.getByRole('button', { name: '좋아요' }));
  await waitFor(() =>
    expect(onUrlUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryString: expect.stringContaining('overlay=login') }),
    ),
  );
  expect(screen.getByRole('button', { name: /댓글을 작성해 주세요/ })).toBeVisible();
});

it('marks a forked repo with a "Fork" chip next to the role, and only then', async () => {
  serve({ ...base, repo: { ...base.repo, isFork: true } });
  const { unmount } = renderWithProviders(<PostDetail postId="1" />);
  expect(await screen.findByRole('heading', { name: base.intro })).toBeVisible();
  expect(screen.getByText('프론트엔드 개발')).toBeVisible();
  expect(screen.getByText('Fork')).toBeVisible();
  unmount();

  serve(base);
  renderWithProviders(<PostDetail postId="1" />);
  expect(await screen.findByRole('heading', { name: base.intro })).toBeVisible();
  expect(screen.queryByText('Fork')).not.toBeInTheDocument();
});

it('applies a like at once and rolls it back when the server fails', async () => {
  // The server answers only when the test says so: optimistic state first, then the failure
  let failLike: (error: unknown) => void = () => undefined;
  serve(
    base,
    () =>
      new Promise((_, reject) => {
        failLike = reject;
      }),
  );
  const user = userEvent.setup();
  renderWithProviders(<PostDetail postId="1" />, {
    viewer: { role: 'developer', login: 'developer' },
  });
  const like = await screen.findByRole('button', { name: '좋아요' });
  await user.click(like);
  await waitFor(() => expect(like).toHaveAttribute('aria-pressed', 'true'));
  expect(screen.getByRole('button', { name: /좋아요 43/ })).toBeVisible();
  failLike(new ApiError(500, { code: 'UNKNOWN', message: '잠시 후 다시 시도해 주세요' }));
  await waitFor(() => expect(like).toHaveAttribute('aria-pressed', 'false'));
  expect(screen.getByRole('button', { name: /좋아요 42/ })).toBeVisible();
});

it('writes a comment from the field', async () => {
  serve(base);
  const user = userEvent.setup();
  renderWithProviders(<PostDetail postId="1" />, {
    viewer: { role: 'developer', login: 'developer' },
  });
  await user.type(await screen.findByLabelText('댓글'), '감사해요');
  await user.click(screen.getByRole('button', { name: '등록' }));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/posts/1/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '감사해요' }),
    }),
  );
});

it('hides reactions from recruiters and marks a hidden post for its author', async () => {
  serve(base);
  const { unmount } = renderWithProviders(<PostDetail postId="1" />, {
    viewer: { role: 'recruiter', login: 'recruiter' },
  });
  expect(await screen.findByRole('heading', { name: base.intro })).toBeVisible();
  expect(screen.queryByRole('button', { name: '좋아요' })).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /좋아요 42/ })).toBeVisible();
  unmount();

  serve({
    ...base,
    isAuthor: true,
    visibility: 'UNDER_REVIEW',
    repo: { ...base.repo, state: 'PRIVATE_OR_DELETED' },
  });
  renderWithProviders(<PostDetail postId="1" />, {
    viewer: { role: 'developer', login: 'linker' },
  });
  expect(await screen.findByText('검토 중')).toBeVisible();
  expect(screen.queryByRole('button', { name: '좋아요' })).not.toBeInTheDocument();
  expect(screen.getByText('레포를 볼 수 없음')).toBeVisible();
});

it('treats a post an operator hid like one under review for its author', async () => {
  serve({ ...base, isAuthor: true, visibility: 'HIDDEN' });
  renderWithProviders(<PostDetail postId="1" />, {
    viewer: { role: 'developer', login: 'linker' },
  });
  expect(await screen.findByText('검토 중')).toBeVisible();
  expect(screen.queryByRole('button', { name: '좋아요' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('댓글')).not.toBeInTheDocument();
});

it('follows the author from the author row and hides the button from recruiters', async () => {
  serve(base);
  const user = userEvent.setup();
  const { unmount } = renderWithProviders(<PostDetail postId="1" />, {
    viewer: { role: 'developer', login: 'developer' },
  });
  const follow = await screen.findByRole('button', { name: '팔로우' });
  await user.click(follow);
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/user/linker/follow', { method: 'POST' }),
  );
  expect(screen.getByRole('button', { name: '팔로잉' })).toHaveAttribute('aria-pressed', 'true');
  unmount();

  serve(base);
  renderWithProviders(<PostDetail postId="1" />, {
    viewer: { role: 'recruiter', login: 'recruiter' },
  });
  expect(await screen.findByRole('heading', { name: base.intro })).toBeVisible();
  expect(screen.queryByRole('button', { name: '팔로우' })).not.toBeInTheDocument();
});

it('edits my own comment and only offers a report on others', async () => {
  serve(base);
  const user = userEvent.setup();
  renderWithProviders(<PostDetail postId="1" />, {
    viewer: { role: 'developer', login: 'doyun' },
  });
  const menus = await screen.findAllByRole('button', { name: '댓글 더보기' });

  // 정태양's comment: report only
  await user.click(menus[1]!);
  expect(await screen.findByRole('menuitem', { name: '신고 하기' })).toBeVisible();
  expect(screen.queryByRole('menuitem', { name: '수정하기' })).not.toBeInTheDocument();
  await user.keyboard('{Escape}');

  // My comment: edit in place
  await user.click(menus[0]!);
  await user.click(await screen.findByRole('menuitem', { name: '수정하기' }));
  const field = screen.getByLabelText('댓글 수정');
  await user.clear(field);
  await user.type(field, '데모가 정말 깔끔해요.');
  await user.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/posts/1/comments/3', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '데모가 정말 깔끔해요.' }),
    }),
  );
});

it('lists other posts for the same repo when there are any', async () => {
  serve(base);
  sameRepo = [
    {
      id: 9,
      author: { id: 4, login: 'doyun', name: '이도윤', avatarUrl: '/mock/avatar.png' },
      intro: '같은 해커톤 백엔드',
      coverUrl: null,
      likeCount: 1,
      commentCount: 0,
    },
  ];
  renderWithProviders(<PostDetail postId="1" />);
  expect(await screen.findByRole('heading', { name: '이 레포의 다른 게시물' })).toBeVisible();
  expect(screen.getByRole('link', { name: /같은 해커톤 백엔드/ })).toHaveAttribute(
    'href',
    '/posts/9',
  );
});
