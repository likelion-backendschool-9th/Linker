import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UrlUpdateEvent } from 'nuqs/adapters/testing';
import { axe } from 'vitest-axe';

import { apiFetch } from '@/lib/api/api-fetch';
import { useToastStore } from '@/stores/toast-store';
import { renderWithProviders } from '@/test/render-with-providers';

import { IssueDetailView } from './IssueDetailView';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);

const person = (id: number, name: string, inTeam = true) => ({
  id,
  login: `user-${id}`,
  name,
  avatarUrl: `https://avatars.githubusercontent.com/u/${id}`,
  inTeam,
});

const issue = {
  id: 1015,
  teamId: 1,
  number: 15,
  repoId: 11,
  repoName: 'linker-web',
  title: '피드 카드 컴포넌트',
  body: '## 할 일\n- [x] 설계\n- [ ] 구현\n\n<script>alert(1)</script>[문서](https://docs.github.com)',
  status: 'IN_PROGRESS',
  statusColor: 'BLUE',
  state: 'OPEN',
  assignees: [person(1, '한서준'), person(6, '강지우', false)],
  labels: [{ name: 'feature', color: '0e8a16' }],
  startDate: '2026-10-28',
  dueDate: '2026-10-30',
  overdue: true,
  inProject: true,
  author: person(1, '한서준'),
  githubUrl: 'https://github.com/example/linker-web/issues/15',
  createdAt: '2026-10-20T00:00:00Z',
  updatedAt: '2026-10-30T00:00:00Z',
  subIssues: { total: 3, done: 1 },
  canWrite: true,
  syncFailed: true,
  deletedOrMoved: null,
  movedToIssueId: null,
};

/** A tiny server: GET returns the current issue, PUT status changes it (like the real API) */
function mockDetail(overrides: Partial<typeof issue> = {}) {
  let current = { ...issue, ...overrides };
  fetchMock.mockImplementation(async (url, init) => {
    if (init?.method === 'PUT' && url.endsWith('/status')) {
      current = { ...current, status: 'DONE', statusColor: 'GREEN', state: 'CLOSED' };
      return { status: current.status, statusColor: current.statusColor, state: current.state };
    }
    if (url.endsWith('/sub-issues')) {
      return {
        total: 3,
        done: 1,
        items: [
          { id: null, number: 150, title: '하위 작업 1', state: 'CLOSED' },
          { id: null, number: 151, title: '하위 작업 2', state: 'OPEN' },
        ],
      };
    }
    return current;
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  useToastStore.setState({ toasts: [] });
});

it('shows the Figma 12 fields, sync failure, sub-issues and safe markdown, accessibly', async () => {
  mockDetail();
  const { container } = renderWithProviders(<IssueDetailView teamId="1" issueId="1015" />, {
    viewer: { role: 'developer', login: 'user-1' },
  });
  expect(
    await screen.findByRole('heading', { level: 2, name: /^피드 카드 컴포넌트/ }),
  ).toBeVisible();
  expect(screen.getByText('#15')).toBeVisible();
  expect(screen.getByText('한서준 작성')).toBeVisible();
  expect(screen.getByRole('button', { name: '상태 작업 중' })).toBeVisible();
  expect(screen.getByText('팀 밖 사용자')).toBeVisible();
  expect(screen.getByText('2026년 10월 28일')).toBeVisible();
  expect(container.querySelector('[data-overdue="true"]')).not.toBeNull();
  expect(screen.getByText('일정이 GitHub에 반영되지 않았어요')).toBeInTheDocument();
  expect(screen.getByText('1/3 완료')).toBeVisible();
  expect(await screen.findByText('하위 작업 2')).toBeVisible();
  expect(screen.getByRole('heading', { level: 3, name: '이슈 본문' })).toBeVisible();
  // Task list marks carry their state in text; scripts never render
  expect(screen.getByText('완료:')).toBeInTheDocument();
  expect(container.querySelector('script')).toBeNull();
  expect(await axe(container)).toHaveNoViolations();
});

it.each([
  [/^상태 /, 'issue-status'],
  [/^라벨 /, 'issue-labels'],
  [/^담당자 /, 'issue-assignees'],
  [/^마감일 /, 'issue-schedule'],
])(
  'opens the sheet of the line %s through the URL when the viewer can write',
  async (name, overlay) => {
    mockDetail();
    const updates: UrlUpdateEvent[] = [];
    renderWithProviders(<IssueDetailView teamId="1" issueId="1015" />, {
      viewer: { role: 'developer', login: 'user-1' },
      onUrlUpdate: (event) => updates.push(event),
    });
    await userEvent.click(await screen.findByRole('button', { name }));
    expect(updates.at(-1)?.searchParams.get('overlay')).toBe(overlay);
  },
);

it('saves a status and shows it right away', async () => {
  mockDetail();
  renderWithProviders(<IssueDetailView teamId="1" issueId="1015" />, {
    viewer: { role: 'developer', login: 'user-1' },
    searchParams: '?overlay=issue-status',
  });
  await userEvent.click(await screen.findByRole('radio', { name: /작업 완료/ }));
  await userEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/teams/1/issues/1015/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DONE' }),
    }),
  );
  expect(
    await screen.findByRole('button', { name: '상태 작업 완료', hidden: true }),
  ).toBeInTheDocument();
});

it('keeps the info lines focusable but explains why without write permission', async () => {
  mockDetail({ canWrite: false });
  const updates: UrlUpdateEvent[] = [];
  renderWithProviders(<IssueDetailView teamId="2" issueId="2003" />, {
    viewer: { role: 'developer', login: 'user-1' },
    onUrlUpdate: (event) => updates.push(event),
  });
  for (const name of [/^상태 /, /^라벨 /, /^담당자 /, /^시작일 /, /^마감일 /]) {
    expect(await screen.findByRole('button', { name })).toHaveAttribute('aria-disabled', 'true');
  }
  await userEvent.click(screen.getByRole('button', { name: /^담당자 / }));
  expect(useToastStore.getState().toasts.at(-1)?.message).toBe(
    '이 레포에 쓸 권한이 없어요. 레포 관리자에게 권한을 요청해 주세요.',
  );
  expect(updates).toHaveLength(0);
});
