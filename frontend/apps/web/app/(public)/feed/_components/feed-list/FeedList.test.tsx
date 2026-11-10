import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import { apiFetch } from '@/lib/api/api-fetch';
import { ApiError } from '@/lib/api/api-error';
import { useToastStore } from '@/stores/toast-store';
import { renderWithProviders } from '@/test/render-with-providers';

import type { FeedItem } from '../../_lib/feed-queries';
import { FeedList } from './FeedList';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);
vi.setConfig({ testTimeout: 15_000 });

// jsdom has no matchMedia; the feed asks it for its column count (one column here)
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
});

const author = { id: 2, login: 'doyun', name: '이도윤', avatarUrl: '/mock/avatar.png' };
const post = (id: number, rest: Partial<Extract<FeedItem, { type: 'POST' }>['post']> = {}) => ({
  type: 'POST' as const,
  whyShown: 'React를 쓰는 사람들의 인기 글',
  post: {
    id,
    author: { ...author, jobStatus: 'SEEKING' as const, isFollowing: false },
    intro: `작업물 ${id}`,
    excerpt: `작업물 ${id} 본문 미리보기입니다.`,
    coverUrl: '/mock/cover-1.svg',
    repoFullName: `doyun/repo-${id}`,
    language: 'TypeScript',
    likeCount: 10,
    likedByMe: false,
    commentCount: 2,
    createdAt: '2026-10-30T00:00:00Z',
    ...rest,
  },
});
const ad: FeedItem = {
  type: 'AD',
  adId: 1,
  companyName: '넥스트랩',
  title: '프론트엔드 개발자',
  jobCategory: 'FRONTEND',
  closesOn: '2099-11-30',
};

function serve(items: FeedItem[]) {
  fetchMock.mockImplementation(async (url) => {
    if (url.startsWith('/api/v1/public/feed')) return { items, nextCursor: null };
    if (url === '/api/v1/public/job-categories') return [{ key: 'FRONTEND', label: '프론트엔드' }];
    if (url === '/api/v1/public/posts/1/comments') {
      return {
        items: [
          {
            id: 1,
            author: { ...author, id: 7, login: 'jh1209', name: '김재호' },
            text: '구조가 깔끔해서 참고하고 있어요!',
            createdAt: '2026-10-12T03:00:00Z',
          },
        ],
      };
    }
    if (url === '/api/v1/user/feed/recommended-users') {
      return {
        items: [
          { user: { ...author, id: 9, login: 'serin', name: '오세린' }, techStack: ['Figma'] },
        ],
      };
    }
    return undefined;
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  useToastStore.setState({ toasts: [] });
});

it('shows guests post cards and sends "게시물 쓰기" to the login prompt', async () => {
  serve([post(1), post(2, { coverUrl: null })]);
  const user = userEvent.setup();
  const onUrlUpdate = vi.fn();
  const { container } = renderWithProviders(<FeedList />, { onUrlUpdate });

  const card = await screen.findByRole('article', { name: '작업물 1' });
  expect(within(card).getByRole('link', { name: '작업물 1' })).toHaveAttribute(
    'href',
    '/posts/1?from=feed',
  );
  expect(within(card).getByText('React를 쓰는 사람들의 인기 글')).toBeInTheDocument();
  expect(within(card).getByText('구직 중')).toBeVisible();
  expect(within(card).getByText('doyun')).toBeVisible();
  expect(within(card).getByRole('button', { name: '팔로우' })).toBeVisible();
  // A short excerpt fits in two lines: no "더 보기" (it only follows a cut excerpt)
  expect(within(card).getByText('작업물 1 본문 미리보기입니다.')).toBeVisible();
  expect(within(card).getByText('더 보기')).not.toBeVisible();
  // No photos: the repo card stands in for the cover
  expect(screen.getByText('doyun/repo-2')).toBeVisible();
  expect(screen.getAllByRole('listitem')[0]).toHaveAttribute('aria-setsize', '2');
  expect(await axe(container)).toHaveNoViolations();

  await user.click(screen.getByRole('button', { name: '게시물 쓰기' }));
  await waitFor(() =>
    expect(onUrlUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryString: expect.stringContaining('overlay=login') }),
    ),
  );
});

it('lets a developer close a job ad and undo it from the toast', async () => {
  serve([post(1), ad]);
  const user = userEvent.setup();
  renderWithProviders(<FeedList />, { viewer: { role: 'developer', login: 'developer' } });

  const adCard = await screen.findByRole('article', { name: '프론트엔드 개발자' });
  expect(within(adCard).getByText('광고')).toBeVisible();
  expect(await within(adCard).findByText(/프론트엔드 ·/)).toBeVisible();

  await user.click(within(adCard).getByRole('button', { name: '광고 닫기' }));
  await waitFor(() =>
    expect(screen.queryByRole('article', { name: '프론트엔드 개발자' })).not.toBeInTheDocument(),
  );
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/ads/1/dismiss', { method: 'POST' });
  const [toast] = useToastStore.getState().toasts;
  expect(toast?.message).toBe('광고를 닫았어요. 7일 동안 보이지 않아요.');
  toast?.action?.onClick();
  expect(await screen.findByRole('article', { name: '프론트엔드 개발자' })).toBeVisible();
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/ads/1/dismiss', { method: 'DELETE' });
});

it('gives recruiters the offers-only toggle and no write button', async () => {
  serve([post(1)]);
  const user = userEvent.setup();
  renderWithProviders(<FeedList />, { viewer: { role: 'recruiter', login: 'recruiter' } });

  await screen.findByRole('article', { name: '작업물 1' });
  expect(screen.queryByRole('button', { name: '게시물 쓰기' })).not.toBeInTheDocument();
  // Recruiters can't follow: "추천" only, no "팔로잉" tab
  expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['추천']);
  // ...and no follow chip on the cards
  const card = screen.getByRole('article', { name: '작업물 1' });
  expect(within(card).queryByRole('button', { name: /팔로우|팔로잉/ })).not.toBeInTheDocument();
  const toggle = screen.getByRole('button', { name: '제안 받는 개발자만' });
  expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await user.click(toggle);
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/public/feed?offersOnly=true',
      expect.anything(),
    ),
  );
  expect(toggle).toHaveAttribute('aria-pressed', 'true');
});

it('recommends developers to follow when the feed is empty', async () => {
  serve([]);
  const user = userEvent.setup();
  renderWithProviders(<FeedList />, { viewer: { role: 'developer', login: 'developer' } });

  expect(await screen.findByText('아직 볼 글이 없어요.')).toBeVisible();
  const follow = await screen.findByRole('button', { name: '오세린 팔로우' });
  await user.click(follow);
  expect(follow).toHaveAttribute('aria-pressed', 'true');
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/user/serin/follow', { method: 'POST' }),
  );
});

it('shows my like and follow on the card (Figma 92:249 / 92:259)', async () => {
  serve([
    post(1, {
      likedByMe: true,
      author: { ...author, jobStatus: 'OFF', isFollowing: true },
    }),
  ]);
  renderWithProviders(<FeedList />);

  const card = await screen.findByRole('article', { name: '작업물 1' });
  expect(within(card).getByRole('button', { name: '팔로잉' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(within(card).getByRole('button', { name: '좋아요' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(within(card).getByText('구직 안 함')).toBeVisible();
});

it('toggles the heart at once and keeps the server count (optimistic like)', async () => {
  serve([post(1, { likeCount: 10 })]);
  let resolve: (value: { likeCount: number }) => void = () => undefined;
  const user = userEvent.setup();
  renderWithProviders(<FeedList />, { viewer: { role: 'developer', login: 'seojun-han' } });

  const card = await screen.findByRole('article', { name: '작업물 1' });
  fetchMock.mockImplementationOnce(
    () => new Promise<{ likeCount: number }>((done) => (resolve = done)),
  );
  await user.click(within(card).getByRole('button', { name: '좋아요' }));

  // Before the server answers
  expect(within(card).getByRole('button', { name: '좋아요' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(within(card).getByText('11')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/posts/1/likes', { method: 'POST' });

  resolve({ likeCount: 12 });
  expect(await within(card).findByText('12')).toBeInTheDocument();
});

it('puts the heart back when the like fails', async () => {
  serve([post(1, { likeCount: 10 })]);
  const user = userEvent.setup();
  renderWithProviders(<FeedList />, { viewer: { role: 'developer', login: 'seojun-han' } });

  const card = await screen.findByRole('article', { name: '작업물 1' });
  fetchMock.mockRejectedValueOnce(new Error('offline'));
  await user.click(within(card).getByRole('button', { name: '좋아요' }));

  await waitFor(() =>
    expect(within(card).getByRole('button', { name: '좋아요' })).toHaveAttribute(
      'aria-pressed',
      'false',
    ),
  );
  expect(within(card).getByText('10')).toBeInTheDocument();
});

it('opens the comment sheet from the card (Figma 374:3944)', async () => {
  serve([post(1, { commentCount: 1 })]);
  const user = userEvent.setup();
  const onUrlUpdate = vi.fn();
  renderWithProviders(<FeedList />, {
    viewer: { role: 'developer', login: 'seojun-han' },
    onUrlUpdate,
  });

  const card = await screen.findByRole('article', { name: '작업물 1' });
  await user.click(within(card).getByRole('button', { name: /댓글\s*1/ }));
  await waitFor(() =>
    expect(onUrlUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryString: expect.stringContaining('overlay=feed-comments') }),
    ),
  );
});

it('gives guests the login prompt on 팔로우 and the heart (04 ch. 2: actions need login)', async () => {
  serve([post(1)]);
  const user = userEvent.setup();

  // A fresh feed per button: once the login overlay is open, a second press changes no URL
  for (const name of ['팔로우', '좋아요']) {
    const onUrlUpdate = vi.fn();
    const { unmount } = renderWithProviders(<FeedList />, { onUrlUpdate });
    const card = await screen.findByRole('article', { name: '작업물 1' });
    await user.click(within(card).getByRole('button', { name }));
    await waitFor(() =>
      expect(onUrlUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({ queryString: expect.stringContaining('overlay=login') }),
      ),
    );
    unmount();
  }
  // Nothing was sent for the guest
  expect(fetchMock.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(
    true,
  );
});

it('opens the share drawer from the paper plane, and the login prompt for guests (Figma 780:584)', async () => {
  serve([post(1)]);
  const user = userEvent.setup();
  const onUrlUpdate = vi.fn();
  const { unmount } = renderWithProviders(<FeedList />, {
    viewer: { role: 'developer', login: 'seojun-han' },
    onUrlUpdate,
  });

  let card = await screen.findByRole('article', { name: '작업물 1' });
  await user.click(within(card).getByRole('button', { name: '채팅방에 공유' }));
  await waitFor(() =>
    expect(onUrlUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryString: expect.stringContaining('overlay=feed-share') }),
    ),
  );
  unmount();

  const guestUrl = vi.fn();
  renderWithProviders(<FeedList />, { onUrlUpdate: guestUrl });
  card = await screen.findByRole('article', { name: '작업물 1' });
  await user.click(within(card).getByRole('button', { name: '채팅방에 공유' }));
  await waitFor(() =>
    expect(guestUrl).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryString: expect.stringContaining('overlay=login') }),
    ),
  );
});

it('shows 추천 / 팔로잉 tabs and loads posts by people I follow on 팔로잉 (Figma 785:770)', async () => {
  serve([post(1)]);
  const user = userEvent.setup();
  renderWithProviders(<FeedList />, { viewer: { role: 'developer', login: 'seojun-han' } });

  const recommended = screen.getByRole('tab', { name: '추천' });
  expect(recommended).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel', { name: '추천' })).toBeInTheDocument();
  await screen.findByRole('article', { name: '작업물 1' });

  await user.click(screen.getByRole('tab', { name: '팔로잉' }));
  expect(screen.getByRole('tab', { name: '팔로잉' })).toHaveAttribute('aria-selected', 'true');
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/public/feed?tab=following', expect.anything()),
  );
  expect(await screen.findByRole('article', { name: '작업물 1' })).toBeInTheDocument();
});

it('tells guests on 팔로잉 to log in, without asking the server', async () => {
  serve([post(1)]);
  const user = userEvent.setup();
  const onUrlUpdate = vi.fn();
  renderWithProviders(<FeedList />, { searchParams: '?tab=following', onUrlUpdate });

  expect(screen.getByText('로그인하지 않으면 팔로잉 피드를 불러올 수 없어요.')).toBeVisible();
  expect(fetchMock.mock.calls.some(([url]) => url.includes('tab=following'))).toBe(false);

  await user.click(screen.getByRole('button', { name: '로그인 하러 가기' }));
  await waitFor(() =>
    expect(onUrlUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryString: expect.stringContaining('overlay=login') }),
    ),
  );
});

it('says nobody is followed when 팔로잉 is empty', async () => {
  serve([]);
  renderWithProviders(<FeedList />, {
    viewer: { role: 'developer', login: 'seojun-han' },
    searchParams: '?tab=following',
  });
  expect(await screen.findByText('팔로잉한 사용자가 없습니다.')).toBeVisible();
  // The 추천 empty state's follow suggestions stay on 추천
  expect(screen.queryByText('아직 볼 글이 없어요.')).not.toBeInTheDocument();
});

it('follows from the card and flips every card by the same author, never on my own', async () => {
  serve([
    post(1),
    post(2),
    post(3, {
      author: { ...author, id: 5, login: 'seojun-han', jobStatus: 'OFF', isFollowing: false },
    }),
  ]);
  const user = userEvent.setup();
  renderWithProviders(<FeedList />, { viewer: { role: 'developer', login: 'seojun-han' } });

  const first = await screen.findByRole('article', { name: '작업물 1' });
  const second = screen.getByRole('article', { name: '작업물 2' });
  const mine = screen.getByRole('article', { name: '작업물 3' });
  expect(within(mine).queryByRole('button', { name: /팔로우|팔로잉/ })).not.toBeInTheDocument();

  await user.click(within(first).getByRole('button', { name: '팔로우' }));

  expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/user/doyun/follow', { method: 'POST' });
  expect(within(first).getByRole('button', { name: '팔로잉' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(within(second).getByRole('button', { name: '팔로잉' })).toBeVisible();
});

it('puts the follow chip back and shows the server copy when following fails', async () => {
  serve([post(1)]);
  const user = userEvent.setup();
  renderWithProviders(<FeedList />, { viewer: { role: 'developer', login: 'seojun-han' } });

  const card = await screen.findByRole('article', { name: '작업물 1' });
  fetchMock.mockRejectedValueOnce(
    new ApiError(429, {
      code: 'RATE_LIMITED',
      message: '오늘은 더 할 수 없어요. 내일 다시 시도해 주세요.',
    }),
  );
  await user.click(within(card).getByRole('button', { name: '팔로우' }));

  await waitFor(() =>
    expect(within(card).getByRole('button', { name: '팔로우' })).toHaveAttribute(
      'aria-pressed',
      'false',
    ),
  );
  expect(useToastStore.getState().toasts.map((toast) => toast.message)).toEqual([
    '오늘은 더 할 수 없어요. 내일 다시 시도해 주세요.',
  ]);
});
