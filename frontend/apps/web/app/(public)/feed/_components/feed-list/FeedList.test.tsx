import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import { apiFetch } from '@/lib/api/api-fetch';
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
  whyShown: '이번 주 인기',
  post: {
    id,
    author: { ...author, jobStatus: 'SEEKING' as const },
    intro: `작업물 ${id}`,
    coverUrl: '/mock/cover-1.svg',
    repoFullName: `doyun/repo-${id}`,
    language: 'TypeScript',
    likeCount: 10,
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
  expect(within(card).getByText('이번 주 인기')).toBeVisible();
  expect(within(card).getByText('구직 중')).toBeVisible();
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
