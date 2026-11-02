import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import type { MyApplication, RecruitSummary } from '../_lib/recruit-list-queries';
import { RecruitList } from './recruit-list';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);

const recruit: RecruitSummary = {
  id: 1,
  title: 'Linker 해커톤팀 백엔드/디자이너 모집',
  author: { id: 1, login: 'linker', name: '김링커', avatarUrl: '/mock/avatar.png' },
  format: 'ONLINE',
  region: null,
  goal: 'HACKATHON',
  deadline: '2099-12-31',
  status: 'OPEN',
  techTags: ['Next.js', 'Spring Boot', 'PostgreSQL', 'Redis', 'Docker'],
  roles: [
    { id: 11, role: 'BACKEND', name: '백엔드', headcount: 2, filled: 1, remaining: 1 },
    { id: 12, role: 'DESIGN', name: '디자이너', headcount: 1, filled: 1, remaining: 0 },
  ],
  createdAt: '2026-10-29T00:00:00Z',
};

const application = (id: number, status: MyApplication['status']): MyApplication => ({
  id,
  status,
  appliedAt: '2026-10-29T00:00:00Z',
  roleName: '백엔드',
  recruit: { ...recruit, id: id + 100, title: `모집 글 ${id}` },
  teamChatRoomId: status === 'ACCEPTED' ? 7 : null,
});

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url) => {
    if (url.startsWith('/api/v1/public/recruits')) {
      return { items: url.includes('role=') ? [] : [recruit], nextCursor: null };
    }
    if (url.startsWith('/api/v1/user/me/applications/')) return undefined;
    if (url.startsWith('/api/v1/user/me/applications')) {
      return {
        items: [
          application(1, 'PENDING'),
          application(2, 'ACCEPTED'),
          application(3, 'REJECTED'),
          application(4, 'EXPIRED'),
        ],
        nextCursor: null,
      };
    }
    return { items: [], nextCursor: null };
  });
});

it('shows a recruit card with remaining slots, stack and accessible markup', async () => {
  const { container } = renderWithProviders(<RecruitList />);
  const card = await screen.findByRole('article', { name: recruit.title });
  expect(within(card).getByRole('link', { name: recruit.title })).toHaveAttribute(
    'href',
    '/recruits/1',
  );
  expect(within(card).getByText('1명 남음')).toBeVisible();
  expect(within(card).getByText('모집 완료')).toBeVisible();
  expect(within(card).getByText('+1')).toBeVisible();
  expect(within(card).getByText('온라인')).toBeVisible();
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/public/recruits?sort=NEWEST', expect.anything());
  expect(await axe(container)).toHaveNoViolations();
});

it('uses the policy copy when filters leave nothing', async () => {
  renderWithProviders(<RecruitList />, { searchParams: '?role=FRONTEND' });
  expect(await screen.findByText('조건에 맞는 모집 글이 없어요.')).toBeVisible();
  expect(screen.getByText('필터를 줄여 보세요.')).toBeVisible();
  expect(screen.getByRole('button', { name: '필터 1' })).toBeVisible();
  expect(screen.getByRole('button', { name: '프론트엔드 필터 해제' })).toBeVisible();
});

it('sends guests to the login prompt for personal tabs and writing', async () => {
  const user = userEvent.setup();
  const onUrlUpdate = vi.fn();
  renderWithProviders(<RecruitList />, { onUrlUpdate });
  await screen.findByRole('article', { name: recruit.title });

  await user.click(screen.getByRole('button', { name: '내 지원' }));
  await waitFor(() =>
    expect(onUrlUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryString: expect.stringContaining('overlay=login') }),
    ),
  );
  expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: '모집 글 쓰기' })).toBeVisible();
});

it('hides tabs and the write button from recruiters', async () => {
  renderWithProviders(<RecruitList />, {
    viewer: { role: 'recruiter', login: 'recruiter' },
    searchParams: '?tab=applied',
  });
  expect(await screen.findByRole('article', { name: recruit.title })).toBeVisible();
  expect(screen.queryByRole('group', { name: '모집 글 보기' })).not.toBeInTheDocument();
  expect(screen.queryByText('모집 글 쓰기')).not.toBeInTheDocument();
});

it('lists my applications by status and cancels a pending one', async () => {
  const user = userEvent.setup();
  const { container } = renderWithProviders(<RecruitList />, {
    viewer: { role: 'developer', login: 'developer' },
    searchParams: '?tab=applied',
  });
  expect(await screen.findByText('검토 중')).toBeVisible();
  expect(screen.getByText('이번엔 함께하지 못하게 됐어요')).toBeVisible();
  expect(screen.getByText('모집이 끝났어요')).toBeVisible();
  expect(screen.getByRole('link', { name: '팀 채팅 바로가기: 모집 글 2' })).toHaveAttribute(
    'href',
    '/chats/7',
  );
  expect(await axe(container)).toHaveNoViolations();

  await user.click(screen.getByRole('button', { name: '지원 취소: 모집 글 1' }));
  const dialog = await screen.findByRole('alertdialog', { name: '지원을 취소할까요?' });
  await user.click(within(dialog).getByRole('button', { name: '지원 취소' }));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/me/applications/1', {
      method: 'DELETE',
    }),
  );
});
