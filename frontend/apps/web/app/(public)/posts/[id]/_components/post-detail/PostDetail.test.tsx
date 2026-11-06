import { screen, waitFor, within } from '@testing-library/react';
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
    parentId: null,
    author: { id: 4, login: 'doyun', name: '이도윤', avatarUrl: '/mock/avatar.png' },
    text: '삭제된 댓글입니다',
    deleted: true,
    createdAt: '2026-10-31T00:00:00Z',
    editedAt: null,
  },
  {
    id: 4,
    parentId: 3,
    author: { id: 1, login: 'linker', name: '김링커', avatarUrl: '/mock/avatar.png' },
    text: '답글은 남아 있어요.',
    deleted: false,
    createdAt: '2026-10-31T01:00:00Z',
    editedAt: null,
  },
  {
    id: 5,
    parentId: null,
    author: { id: 7, login: 'taeyang', name: '정태양', avatarUrl: '/mock/avatar.png' },
    text: '구조가 깔끔해요!',
    deleted: false,
    createdAt: '2026-10-31T02:00:00Z',
    editedAt: null,
  },
];

function serve(detail: Detail, like?: () => unknown) {
  fetchMock.mockImplementation(async (url) => {
    if (url.startsWith('/api/v1/public/posts/1/comments')) return { items: comments };
    if (url.startsWith('/api/v1/public/posts/1/readme'))
      return { markdown: '# linker-web\n\n실행 방법' };
    if (url.startsWith('/api/v1/public/posts/1/same-repo-posts')) return { items: [] };
    if (url.startsWith('/api/v1/public/posts/1')) return detail;
    if (url.endsWith('/likes')) return like?.();
    if (url.endsWith('/comments')) return comments[2];
    return undefined;
  });
}

beforeEach(() => {
  fetchMock.mockReset();
});

it('shows a guest the whole post and sends reactions to the login prompt', async () => {
  serve(base);
  const user = userEvent.setup();
  const onUrlUpdate = vi.fn();
  const { container } = renderWithProviders(<PostDetail postId="1" />, { onUrlUpdate });

  expect(await screen.findByRole('heading', { name: base.intro })).toBeVisible();
  expect(screen.getByText('구직 중')).toBeVisible();
  expect(screen.getByText(/수정됨/)).toBeVisible();
  expect(screen.getByRole('img', { name: 'linker-web 이미지 1' })).toBeVisible();
  expect(screen.getByText('2026년 10월 ~ 진행 중')).toBeVisible();
  expect(screen.getAllByRole('link', { name: /linker\.example\.dev/ }).length).toBeGreaterThan(0);
  // One level of replies; a deleted comment with replies stays as "삭제된 댓글입니다"
  expect(await screen.findByText('삭제된 댓글입니다')).toBeVisible();
  expect(screen.getByRole('list', { name: '이도윤님 댓글의 답글' })).toBeVisible();
  expect(screen.getByText('작성자')).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();

  await user.click(screen.getByRole('button', { name: 'README' }));
  expect(await screen.findByRole('heading', { name: 'linker-web' })).toBeVisible();

  await user.click(screen.getByRole('button', { name: '좋아요' }));
  await waitFor(() =>
    expect(onUrlUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryString: expect.stringContaining('overlay=login') }),
    ),
  );
  expect(screen.getByRole('button', { name: '로그인하고 댓글 남기기' })).toBeVisible();
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

it('replies to a top-level comment', async () => {
  serve(base);
  const user = userEvent.setup();
  renderWithProviders(<PostDetail postId="1" />, {
    viewer: { role: 'developer', login: 'developer' },
  });
  const comment = await screen.findByRole('article', { name: '정태양' });
  await user.click(within(comment).getByRole('button', { name: /답글 달기/ }));
  expect(screen.getByText('정태양님에게 답글 남기는 중')).toBeVisible();
  await user.type(screen.getByLabelText('정태양님에게 답글'), '감사해요');
  await user.click(screen.getByRole('button', { name: '등록' }));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/posts/1/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '감사해요', parentId: 5 }),
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
  expect(screen.queryByRole('button', { name: 'README' })).not.toBeInTheDocument();
});
