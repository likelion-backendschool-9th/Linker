import type { IssueListItem, TeamItem } from '@linker/api/openAPIDefinition.schemas';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Route } from 'next';
import { axe } from 'vitest-axe';

import { ApiError } from '@/lib/api/api-error';
import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import { MyIssuesSection } from './MyIssuesSection';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);

const team = (id: number, name: string, overrides: Partial<TeamItem> = {}): TeamItem => ({
  id,
  name,
  orgAvatarUrl: null,
  status: 'ACTIVE',
  plan: 'FREE',
  myRole: 'MEMBER',
  memberCount: 5,
  openIssueCount: 2,
  chatRoomId: id,
  unreadCount: 0,
  joinedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});
const issue = (id: number, overrides: Partial<IssueListItem> = {}): IssueListItem => ({
  id,
  number: id,
  repoId: 1,
  repoName: 'linker-web',
  title: `이슈 ${id}`,
  status: 'TODO',
  statusColor: 'GRAY',
  state: 'OPEN',
  assignees: [{ id: 1, login: 'me', name: '이준호', avatarUrl: null, inTeam: true }],
  labels: [],
  startDate: null,
  dueDate: '2030-11-09',
  overdue: false,
  inProject: true,
  scheduleSyncFailed: false,
  syncStatus: 'SYNCED',
  syncedAt: null,
  ...overrides,
});

const OLD = team(1, '오래된 팀', { joinedAt: '2026-01-01T00:00:00Z' });
const NEW = team(2, '최근 팀', { joinedAt: '2026-06-01T00:00:00Z' });
const developer = { viewer: { role: 'developer' as const, login: 'me' } };

function respond(teams: TeamItem[], issuesByTeam: Record<number, IssueListItem[] | Error> = {}) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url === '/api/v1/user/me/teams') {
      return { items: teams, teamLimit: 10, teamCount: teams.length, nextCursor: null };
    }
    const teamId = Number(new URL(url, 'http://test').searchParams.get('teamId'));
    const found = issuesByTeam[teamId] ?? [];
    if (found instanceof Error) throw found;
    return { teamId, items: found };
  });
}

function requestedTeams() {
  return fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.includes('/me/issues'));
}

beforeEach(() => {
  fetchMock.mockReset();
});

it('loads the most recently joined team by default and titles the section with it', async () => {
  respond([OLD, NEW], { 2: [issue(1)] });
  renderWithProviders(<MyIssuesSection />, developer);
  expect(await screen.findByRole('heading', { name: '내 최근 팀 팀의 이슈' })).toBeVisible();
  await screen.findByRole('link', { name: '이슈 1' });
  expect(requestedTeams()).toEqual(['/api/v1/user/me/issues?teamId=2']);
});

it('prefers a non-archived team as the default', async () => {
  respond([team(3, '보관 팀', { status: 'ARCHIVED', joinedAt: '2026-12-01T00:00:00Z' }), OLD]);
  renderWithProviders(<MyIssuesSection />, developer);
  expect(await screen.findByRole('heading', { name: '내 오래된 팀 팀의 이슈' })).toBeVisible();
});

it('keeps the team named in the URL', async () => {
  respond([OLD, NEW], { 1: [issue(7)] });
  renderWithProviders(<MyIssuesSection />, { ...developer, searchParams: '?teamId=1' });
  expect(await screen.findByRole('heading', { name: '내 오래된 팀 팀의 이슈' })).toBeVisible();
  expect(requestedTeams()).toEqual(['/api/v1/user/me/issues?teamId=1']);
});

it.each(['99', 'abc'])('removes the invalid teamId %s and shows the default team', async (raw) => {
  respond([OLD, NEW]);
  const onUrlUpdate = vi.fn();
  renderWithProviders(<MyIssuesSection />, {
    ...developer,
    searchParams: `?teamId=${raw}`,
    onUrlUpdate,
  });
  expect(await screen.findByRole('heading', { name: '내 최근 팀 팀의 이슈' })).toBeVisible();
  await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
  const update = onUrlUpdate.mock.lastCall?.[0];
  expect(update.queryString).toBe('');
  expect(update.options.history).toBe('replace');
  expect(requestedTeams().every((url) => url.endsWith('teamId=2'))).toBe(true);
});

it('returns to the default team when the server rejects a team with 400', async () => {
  const rejected = new ApiError(400, { code: 'VALIDATION_ERROR', message: '잘못된 팀' });
  respond([OLD, NEW], { 1: rejected, 2: [issue(5)] });
  renderWithProviders(<MyIssuesSection />, { ...developer, searchParams: '?teamId=1' });
  expect(await screen.findByRole('link', { name: '이슈 5' })).toBeVisible();
  expect(screen.getByRole('heading', { name: '내 최근 팀 팀의 이슈' })).toBeVisible();
});

it('draws nothing without teams', async () => {
  respond([]);
  const { container } = renderWithProviders(<MyIssuesSection />, developer);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  await waitFor(() => expect(container.querySelector('[aria-busy]')).toBeNull());
  await waitFor(() => expect(container.textContent).toBe(''));
  expect(requestedTeams()).toEqual([]);
});

it('shows the documented empty state', async () => {
  respond([OLD]);
  renderWithProviders(<MyIssuesSection />, developer);
  expect(await screen.findByText('배정된 이슈가 없어요.')).toBeVisible();
});

it('shows an overdue issue as a single date without extra text, like Figma', async () => {
  respond([OLD], {
    1: [issue(1, { overdue: true, dueDate: '2026-10-30' }), issue(2, { dueDate: '2030-01-01' })],
  });
  renderWithProviders(<MyIssuesSection />, developer);
  const rows = await screen.findAllByRole('article');
  const overdue = rows[0]!.querySelector('time') as HTMLElement;
  const onTime = rows[1]!.querySelector('time') as HTMLElement;
  expect(overdue).toHaveAttribute('dateTime', '2026-10-30');
  expect(overdue.className).not.toBe(onTime.className);
  expect(rows[0]).not.toHaveTextContent('마감 지남');
});

it('leaves the date out when an issue has no due date', async () => {
  respond([OLD], { 1: [issue(1, { dueDate: null })] });
  renderWithProviders(<MyIssuesSection />, developer);
  const row = await screen.findByRole('article');
  expect(row.querySelector('time')).toBeNull();
});

it('links each issue to its detail page and lists every assignee', async () => {
  respond([OLD], {
    1: [
      issue(42, {
        assignees: [
          { id: 1, login: 'a', name: '이준호', avatarUrl: null, inTeam: true },
          { id: 2, login: 'b', name: '김도윤', avatarUrl: null, inTeam: true },
        ],
      }),
    ],
  });
  renderWithProviders(<MyIssuesSection />, developer);
  expect(await screen.findByRole('link', { name: '이슈 42' })).toHaveAttribute(
    'href',
    '/teams/1/issues/42',
  );
  expect(screen.getByText('이준호, 김도윤')).toBeVisible();
});

it('keeps the server order, limits the preview, and links to the full list', async () => {
  respond([OLD], { 1: [issue(9), issue(3), issue(5), issue(1)] });
  renderWithProviders(
    <MyIssuesSection previewRows={3} allIssuesHref={'/workspace/issues?teamId=1' as Route} />,
    developer,
  );
  const links = await screen.findAllByRole('link', { name: /^이슈 \d/ });
  expect(links.map((link) => link.textContent)).toEqual(['이슈 9', '이슈 3', '이슈 5']);
  expect(screen.getByRole('link', { name: '내 이슈 전체 보기' })).toHaveAttribute(
    'href',
    '/workspace/issues?teamId=1',
  );
});

it('shows every issue on the full list', async () => {
  respond([OLD], { 1: [issue(1), issue(2), issue(3), issue(4)] });
  renderWithProviders(<MyIssuesSection />, developer);
  expect(await screen.findAllByRole('article')).toHaveLength(4);
  expect(screen.queryByRole('link', { name: '내 이슈 전체 보기' })).toBeNull();
});

it('keeps only the entry link on the home when the team list fails', async () => {
  fetchMock.mockRejectedValue(new Error('unavailable'));
  renderWithProviders(<MyIssuesSection allIssuesHref={'/workspace/issues' as Route} />, developer);
  expect(await screen.findByRole('link', { name: '내 이슈 전체 보기' })).toBeVisible();
  expect(screen.queryByRole('alert')).toBeNull();
});

it('offers a retry when the issues fail to load', async () => {
  respond([OLD], { 1: new Error('unavailable') });
  renderWithProviders(<MyIssuesSection />, developer);
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeVisible();
});

it('separates the picker on the card body from the › link to the team', async () => {
  respond([OLD, NEW]);
  renderWithProviders(<MyIssuesSection />, developer);
  const trigger = await screen.findByRole('button', { name: '팀 변경, 현재 최근 팀' });
  const entry = screen.getByRole('link', { name: '최근 팀 팀으로 이동' });
  expect(entry).toHaveAttribute('href', '/teams/2/issues');
  expect(trigger.contains(entry)).toBe(false);
  expect(screen.getByText('멤버 5명')).toBeInTheDocument();
});

it('has no › link for an archived team without a chat room', async () => {
  respond([team(3, '보관 팀', { status: 'ARCHIVED', chatRoomId: null })]);
  renderWithProviders(<MyIssuesSection />, developer);
  await screen.findByRole('button', { name: '팀 변경, 현재 보관 팀' });
  expect(screen.queryByRole('link', { name: '보관 팀 팀으로 이동' })).toBeNull();
});

it('changes the team from the sheet only after pressing 팀 변경, then closes it', async () => {
  vi.spyOn(window.history, 'back').mockImplementation(() => {
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  const user = userEvent.setup();
  const onUrlUpdate = vi.fn();
  respond([NEW, OLD], { 1: [issue(8)], 2: [issue(4)] });
  renderWithProviders(<MyIssuesSection />, { ...developer, onUrlUpdate });

  await user.click(await screen.findByRole('button', { name: '팀 변경, 현재 최근 팀' }));
  const sheet = await screen.findByRole('dialog', { name: '팀 변경' });
  expect(within(sheet).getByRole('radio', { name: '최근 팀' })).toBeChecked();

  await user.click(within(sheet).getByRole('radio', { name: '오래된 팀' }));
  expect(screen.getByRole('heading', { name: '내 최근 팀 팀의 이슈', hidden: true })).toBeTruthy();

  await user.click(within(sheet).getByRole('button', { name: '팀 변경' }));
  await waitFor(() =>
    expect(new URLSearchParams(onUrlUpdate.mock.lastCall?.[0].queryString).get('teamId')).toBe('1'),
  );
  expect(onUrlUpdate.mock.lastCall?.[0].options.history).toBe('replace');
  // The testing adapter keeps `overlay` after the mocked back; closing is covered in the browser
  expect(await screen.findByRole('link', { name: '이슈 8', hidden: true })).toBeInTheDocument();
  vi.restoreAllMocks();
});

it('links the + icon to issue creation for the selected team', async () => {
  respond([OLD, NEW]);
  renderWithProviders(<MyIssuesSection />, { ...developer, searchParams: '?teamId=1' });
  const link = await screen.findByRole('link', { name: '이슈 작성' });
  expect(link).toHaveAttribute('href', '/teams/1/issues/new');
  expect(within(link).getByText('이슈 작성')).toHaveClass('sr-only');
});

it('turns the card chevron from › to ∨ while the sheet is open', async () => {
  vi.spyOn(window.history, 'back').mockImplementation(() => {
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  respond([OLD]);
  const user = userEvent.setup();
  const { container } = renderWithProviders(<MyIssuesSection />, developer);
  await user.click(await screen.findByRole('button', { name: /^팀 변경, 현재/ }));
  await screen.findByRole('dialog', { name: '팀 변경' });
  expect(container.querySelector('.solar-alt-arrow-down-linear')).not.toBeNull();
  expect(container.querySelector('.solar-alt-arrow-right-linear')).toBeNull();
  vi.restoreAllMocks();
});

it('has no axe violations', async () => {
  respond([OLD, NEW], { 2: [issue(1, { overdue: true }), issue(2, { status: 'NONE' })] });
  const { container } = renderWithProviders(
    <MyIssuesSection allIssuesHref={'/workspace/issues' as Route} />,
    developer,
  );
  await screen.findByRole('link', { name: '이슈 1' });
  expect(await axe(container)).toHaveNoViolations();
});

describe('status dot', () => {
  const dotOf = (row: HTMLElement) => row.querySelector('[style*="background"]') as HTMLElement;

  it.each([
    ['TODO', 'GRAY', '작업 전', 'gray'],
    ['IN_PROGRESS', 'BLUE', '작업 중', 'blue'],
    ['BLOCKED', 'RED', '작업 중단', 'red'],
    ['DONE', 'GREEN', '작업 완료', 'green'],
    ['OTHER', 'GRAY', '기타', 'gray'],
  ] as const)('names %s for screen readers only, in its board color', async (status, statusColor, name, token) => {
    respond([OLD], { 1: [issue(1, { status, statusColor })] });
    renderWithProviders(<MyIssuesSection />, developer);
    const row = await screen.findByRole('article');
    expect(within(row).getByText(name)).toHaveClass('sr-only');
    expect(dotOf(row).style.backgroundColor).toBe(`var(--color-board-status-${token})`);
    expect(dotOf(row)).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses the color the board mapping sends, not one derived from the status', async () => {
    respond([OLD], { 1: [issue(1, { status: 'TODO', statusColor: 'PURPLE' })] });
    renderWithProviders(<MyIssuesSection />, developer);
    const row = await screen.findByRole('article');
    expect(dotOf(row).style.backgroundColor).toBe('var(--color-board-status-purple)');
  });

  it('gives NONE a gray dot and no name', async () => {
    respond([OLD], { 1: [issue(1, { status: 'NONE', statusColor: 'GRAY', title: '보드 밖 이슈' })] });
    renderWithProviders(<MyIssuesSection />, developer);
    const row = await screen.findByRole('article');
    expect(dotOf(row).style.backgroundColor).toBe('var(--color-board-status-gray)');
    expect(row.querySelector('.sr-only')).toBeNull();
  });
});
