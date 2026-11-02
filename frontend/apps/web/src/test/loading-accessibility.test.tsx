import { screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';

import { IssueList } from '@/app/(developer)/teams/[id]/issues/_components/issue-list';
import { RepoTemplateStep } from '@/app/(developer)/teams/[id]/issues/new/_components/repo-template-step';
import { ChatList } from '@/app/(member)/chats/_components/chat-list';
import { NotificationList } from '@/app/(member)/notifications/_components/notification-list';
import { RecruitList } from '@/app/(public)/recruits/_components/recruit-list';
import { apiFetch } from '@/lib/api/api-fetch';

import { renderWithProviders } from './render-with-providers';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);

type Case = {
  name: string;
  ui: () => ReactElement;
  label: string;
  searchParams?: string;
  result?: unknown;
};

const cases: Case[] = [
  { name: 'issue list', ui: () => <IssueList teamId="1" />, label: '이슈를 불러오고 있어요.' },
  { name: 'chat list', ui: () => <ChatList />, label: '채팅 목록을 불러오고 있어요.' },
  { name: 'notifications', ui: () => <NotificationList />, label: '알림을 불러오고 있어요.' },
  ...[
    ['all', '모집 글'],
    ['mine', '내 모집 글'],
    ['applied', '내 지원'],
  ].map(([tab, label]) => ({
    name: `recruit ${tab}`,
    ui: () => <RecruitList />,
    label: `${label}을 불러오고 있어요.`,
    searchParams: `?tab=${tab}`,
  })),
  {
    name: 'issue templates',
    ui: () => (
      <RepoTemplateStep
        teamId="1"
        repoId={11}
        templateKey={null}
        onSelect={vi.fn()}
        onNext={vi.fn()}
      />
    ),
    label: '불러오는 중…',
    result: {
      items: [{ key: 'default:task', source: 'DEFAULT', name: '작업', description: '해야 할 일' }],
    },
  },
];

beforeEach(() => {
  fetchMock.mockReset();
});

describe.each(cases)('$name loading accessibility', ({ ui, label, searchParams, result }) => {
  it.each(['success', 'error'] as const)(
    'announces once outside the busy content and clears on %s',
    async (outcome) => {
      let resolve!: (value: unknown) => void;
      let reject!: (reason: Error) => void;
      const pending = new Promise<unknown>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      fetchMock.mockImplementation(async (url) => {
        if (url.endsWith('/issue-create/repos'))
          return {
            items: [{ id: 11, name: 'linker-web', fullName: 'a/linker-web', canWrite: true }],
          };
        if (url.endsWith('unread-summary'))
          return { TEAM: 0, DIRECT: 0, REQUEST: 0, total: 0, requestCount: 0 };
        if (url.endsWith('unread-count')) return { count: 0 };
        return pending;
      });

      const { container } = renderWithProviders(ui(), {
        viewer: { role: 'developer', login: 'me' },
        searchParams,
      });
      const announcements = () =>
        screen.queryAllByRole('status').filter((element) => element.textContent === label);
      await waitFor(() => expect(announcements()).toHaveLength(1));
      expect(announcements()[0]!.closest('[aria-busy="true"]')).toBeNull();
      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
      expect(container.querySelectorAll('[data-loading-orb]')).toHaveLength(1);

      if (outcome === 'error') reject(new Error('Temporary loading failure'));
      else resolve(result ?? { items: [], nextCursor: null, total: 0, canWrite: true });

      await waitFor(() => expect(container.querySelector('[data-loading-state]')).toBeNull());
      expect(announcements()).toHaveLength(0);
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();
      if (outcome === 'error')
        expect(screen.getByRole('button', { name: '다시 시도' })).toBeVisible();
    },
  );
});
