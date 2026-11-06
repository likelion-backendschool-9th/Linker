import { screen } from '@testing-library/react';
import { axe } from 'vitest-axe';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import { MyIssueList } from './MyIssueList';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);

const overdue = {
  id: 1015,
  teamId: 1,
  teamName: 'Linker',
  repoName: 'linker-web',
  number: 15,
  title: '피드 카드 컴포넌트',
  status: 'IN_PROGRESS',
  dueDate: '2026-10-30',
  overdue: true,
};
const noDue = {
  ...overdue,
  id: 2003,
  teamId: 2,
  teamName: '스터디',
  number: 3,
  title: 'README 정리',
  status: 'TODO',
  dueDate: null,
  overdue: false,
};

beforeEach(() => fetchMock.mockReset());

it('lists my issues with team, overdue text and a link to 12, accessibly', async () => {
  fetchMock.mockResolvedValue({ items: [overdue, noDue] });
  const { container } = renderWithProviders(<MyIssueList />, {
    viewer: { role: 'developer', login: 'me' },
  });

  const link = await screen.findByRole('link', { name: '피드 카드 컴포넌트' });
  expect(link).toHaveAttribute('href', '/teams/1/issues/1015');
  expect(screen.getByText('Linker')).toBeInTheDocument();
  expect(screen.getByText(/마감 지남/)).toBeInTheDocument();
  expect(screen.getByText('마감일 없음')).toBeInTheDocument();
  expect(screen.getByText('작업 중')).toBeInTheDocument();
  expect(screen.getAllByRole('article')).toHaveLength(2);
  expect(await axe(container)).toHaveNoViolations();
});

it('shows the empty state', async () => {
  fetchMock.mockResolvedValue({ items: [] });
  renderWithProviders(<MyIssueList />, { viewer: { role: 'developer', login: 'me' } });
  expect(await screen.findByText('배정된 이슈가 없어요.')).toBeInTheDocument();
});
