import { useQueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import { chatKeys } from '@/features/chat/chat-queries';
import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import { ChatList } from './ChatList';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);
const row = {
  id: 3,
  kind: 'REQUEST',
  title: '김개발',
  counterpart: null,
  requestKind: 'GENERAL',
  requestDirection: 'RECEIVED',
  companyName: null,
  muted: true,
  unreadCount: 1,
  lastMessage: { text: '함께 이야기해요.', createdAt: '2026-10-30T00:00:00Z' },
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url) => {
    if (url.endsWith('unread-summary'))
      return { TEAM: 0, DIRECT: 0, REQUEST: 1, total: 1, requestCount: 1 };
    if (url.includes('tab=REQUEST')) return { items: [row], nextCursor: null };
    return { items: [], nextCursor: null };
  });
});

it('changes tabs through the URL and shows request actions with accessible markup', async () => {
  const user = userEvent.setup();
  const { container } = renderWithProviders(<ChatList />, {
    viewer: { role: 'developer', login: 'developer' },
  });
  await screen.findByText('아직 팀 채팅이 없어요.');
  await user.click(screen.getByRole('button', { name: /요청/ }));
  expect(await screen.findByRole('heading', { name: '김개발' })).toBeVisible();
  expect(screen.getByRole('img', { name: '알림 꺼짐' })).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();
  await user.click(screen.getByRole('button', { name: '김개발 요청 수락' }));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/chat-requests/3/accept', {
      method: 'POST',
    }),
  );
});

it('shows recruiters only personal chats, even with a TEAM URL', async () => {
  renderWithProviders(<ChatList />, {
    viewer: { role: 'recruiter', login: 'recruiter' },
    searchParams: '?tab=TEAM',
  });
  expect(await screen.findByText('아직 개인 대화가 없어요.')).toBeVisible();
  expect(screen.queryByRole('button', { name: '팀' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /요청/ })).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/chat-rooms?tab=DIRECT', expect.anything());
});

it('shows a retry when loading fails and recovers', async () => {
  let offline = true;
  fetchMock.mockImplementation(async (url) => {
    if (url.endsWith('unread-summary'))
      return { TEAM: 0, DIRECT: 0, REQUEST: 0, total: 0, requestCount: 0 };
    if (offline) throw new Error('offline');
    return { items: [], nextCursor: null };
  });
  renderWithProviders(<ChatList />, { viewer: { role: 'developer', login: 'developer' } });
  await screen.findByText('불러오지 못했어요');
  offline = false;
  await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  expect(await screen.findByText('아직 팀 채팅이 없어요.')).toBeVisible();
});

it('deletes a received request only after confirming and refreshes the list', async () => {
  let removed = false;
  fetchMock.mockImplementation(async (url, init) => {
    if (url.endsWith('unread-summary'))
      return { TEAM: 0, DIRECT: 0, REQUEST: 0, total: 0, requestCount: removed ? 0 : 1 };
    if (init?.method === 'DELETE') {
      removed = true;
      return undefined;
    }
    return { items: removed ? [] : [row], nextCursor: null };
  });
  renderWithProviders(<ChatList />, {
    viewer: { role: 'developer', login: 'developer' },
    searchParams: '?tab=REQUEST&overlay=delete-confirm&oid=3',
  });
  await screen.findByText('김개발');
  await userEvent.click(screen.getByRole('button', { name: '삭제' }));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/chat-requests/3', { method: 'DELETE' }),
  );
  expect(await screen.findByText('받은 메시지 요청이 없어요.')).toBeVisible();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

it('omits a missing team name and a missing preview without inventing copy', async () => {
  fetchMock.mockImplementation(async (url) => {
    if (url.endsWith('unread-summary'))
      return { TEAM: 1, DIRECT: 0, REQUEST: 0, total: 1, requestCount: 0 };
    if (url.includes('tab=TEAM')) {
      return {
        items: [
          {
            id: 8,
            kind: 'TEAM',
            title: null,
            counterpart: null,
            requestKind: null,
            requestDirection: null,
            companyName: null,
            muted: false,
            unreadCount: 1,
            lastMessage: { text: null, createdAt: '2026-11-01T00:00:00Z' },
          },
        ],
        nextCursor: null,
      };
    }
    return { items: [], nextCursor: null };
  });
  renderWithProviders(<ChatList />, { viewer: { role: 'developer', login: 'developer' } });
  expect(await screen.findByLabelText('읽지 않은 메시지 1개')).toBeVisible();
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  expect(screen.queryByText('아직 메시지가 없어요.')).not.toBeInTheDocument();
  expect(screen.queryByText('사진을 보냈어요')).not.toBeInTheDocument();
});

/** Stands in for the bottom-tab subscription: a CHAT_ROOMS_CHANGED frame invalidates the account cache. */
function RoomsChanged() {
  const client = useQueryClient();
  return (
    <button
      type="button"
      onClick={() => {
        void client.invalidateQueries({ queryKey: chatKeys.account('developer') });
      }}
    >
      방 목록 변경 알림
    </button>
  );
}

it('shows the server list again after joining and after leaving a team', async () => {
  const user = userEvent.setup();
  const team = { ...row, id: 8, kind: 'TEAM', title: 'Linker 해커톤팀', requestKind: null };
  let teamRooms: (typeof team)[] = [];
  fetchMock.mockImplementation(async (url) => {
    if (url.endsWith('unread-summary'))
      return { TEAM: 0, DIRECT: 0, REQUEST: 0, total: 0, requestCount: 0 };
    if (url.includes('tab=TEAM')) return { items: teamRooms, nextCursor: null };
    return { items: [], nextCursor: null };
  });
  renderWithProviders(
    <>
      <ChatList />
      <RoomsChanged />
    </>,
    { viewer: { role: 'developer', login: 'developer' } },
  );
  expect(await screen.findByText('아직 팀 채팅이 없어요.')).toBeVisible();

  teamRooms = [team];
  await user.click(screen.getByRole('button', { name: '방 목록 변경 알림' }));
  expect(await screen.findByRole('heading', { name: 'Linker 해커톤팀' })).toBeVisible();
  expect(screen.queryByText('아직 팀 채팅이 없어요.')).not.toBeInTheDocument();

  teamRooms = [];
  await user.click(screen.getByRole('button', { name: '방 목록 변경 알림' }));
  expect(await screen.findByText('아직 팀 채팅이 없어요.')).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Linker 해커톤팀' })).not.toBeInTheDocument();
});
