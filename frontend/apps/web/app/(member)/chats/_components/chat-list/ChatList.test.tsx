import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { act } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { axe } from 'vitest-axe';

import { chatKeys, chatRoomsOptions, type UnreadSummary } from '@/features/chat/chat-queries';
import { apiFetch } from '@/lib/api/api-fetch';
import { ViewerProvider } from '@/lib/auth/viewer-context';
import { renderWithProviders } from '@/test/render-with-providers';

import { ChatList } from './ChatList';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);
const row = {
  id: 3,
  kind: 'REQUEST',
  title: '김개발',
  teamId: null,
  counterpart: null,
  requestKind: 'GENERAL',
  requestDirection: 'RECEIVED',
  companyName: null,
  muted: true,
  unreadCount: 1,
  lastMessage: { id: 31, text: '함께 이야기해요.', createdAt: '2026-10-30T00:00:00Z' },
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url) => {
    if (url.endsWith('unread-summary'))
      return { TEAM: 0, DIRECT: 0, REQUEST: 1, total: 1, requestCount: 1 };
    if (url.includes('tab=REQUEST')) return { items: [row], nextCursor: null };
    if (url.endsWith('/accept')) return { roomId: 3 };
    return { items: [], nextCursor: null };
  });
});

it('renders the request badge in server HTML and hydrates without a recoverable error', async () => {
  const summary: UnreadSummary = { TEAM: 0, DIRECT: 0, REQUEST: 1, total: 1, requestCount: 1 };
  const makeTree = (client: QueryClient) => (
    <QueryClientProvider client={client}>
      <HydrationBoundary state={dehydrate(client)}>
        <NuqsTestingAdapter>
          <ViewerProvider
            viewer={{
              role: 'developer',
              login: 'developer',
              status: 'ACTIVE',
              suspendedUntil: null,
            }}
          >
            <ChatList initialSummary={summary} />
          </ViewerProvider>
        </NuqsTestingAdapter>
      </HydrationBoundary>
    </QueryClientProvider>
  );
  const makeClient = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(chatRoomsOptions('developer', 'TEAM').queryKey, {
      pages: [{ items: [], nextCursor: null }],
      pageParams: [null],
    });
    // No summary in the cache: as on the Next server, the badge must come from `initialSummary`.
    return client;
  };
  const container = document.createElement('div');
  container.innerHTML = renderToString(makeTree(makeClient()));
  document.body.append(container);
  expect(container.querySelector('span[aria-label="받은 요청 1건"]')).not.toBeNull();

  const hydrationErrors: unknown[] = [];
  let root: Root | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(container, makeTree(makeClient()), {
        onRecoverableError: (error) => hydrationErrors.push(error),
      });
    });
    expect(hydrationErrors).toEqual([]);
  } finally {
    if (root) await act(async () => root!.unmount());
    container.remove();
  }
});

it('changes tabs through the URL and shows the Figma request row with accessible markup', async () => {
  const user = userEvent.setup();
  const { container } = renderWithProviders(<ChatList />, {
    viewer: { role: 'developer', login: 'developer' },
  });
  await screen.findByText('아직 팀 채팅이 없어요.');
  await user.click(screen.getByRole('button', { name: /요청/ }));
  expect(await screen.findByRole('heading', { name: '김개발' })).toBeVisible();
  expect(screen.getByRole('img', { name: '알림 꺼짐' })).toBeVisible();
  expect(screen.getByRole('button', { name: /^요청/ })).toHaveAttribute('aria-pressed', 'true');
  expect(await axe(container)).toHaveNoViolations();
  // Latest design: a request row has no buttons; delete is in the row menu, accept in 17's panel.
  expect(screen.queryByRole('button', { name: /요청 삭제/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /요청 수락/ })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /김개발/ })).toHaveAttribute('href', '/chats/3');
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

it('deletes a received request from the row menu only after confirming and refreshes the list', async () => {
  const user = userEvent.setup();
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
    searchParams: '?tab=REQUEST',
  });
  fireEvent.contextMenu(
    (await screen.findByRole('heading', { name: '김개발' })).closest('article')!,
  );
  const sheet = await screen.findByRole('dialog', { name: '김개발님과의 채팅방' });
  await user.click(within(sheet).getByRole('button', { name: '방 나가기' }));
  const confirm = await screen.findByRole('alertdialog', { name: '메시지 요청을 삭제할까요?' });
  expect(fetchMock).not.toHaveBeenCalledWith('/api/v1/user/chat-requests/3', { method: 'DELETE' });
  await user.click(within(confirm).getByRole('button', { name: '삭제' }));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/chat-requests/3', { method: 'DELETE' }),
  );
  expect(await screen.findByText('받은 메시지 요청이 없어요.')).toBeVisible();
  // The confirm closes with history.back() (the menu pushed the overlay), which the nuqs testing
  // adapter doesn't follow; the browser check covers that.
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

describe('row menu (right-click / long press)', () => {
  const direct = { ...row, id: 5, kind: 'DIRECT', requestDirection: null, title: '이도윤' };
  const team = {
    ...row,
    id: 8,
    kind: 'TEAM',
    title: 'ShowMoa',
    teamId: 4,
    requestKind: null,
    requestDirection: null,
  };
  const sent = { ...row, id: 9, requestDirection: 'SENT', unreadCount: 0 };

  function serve(byTab: Record<string, unknown[]>) {
    fetchMock.mockImplementation(async (url) => {
      if (url.endsWith('unread-summary'))
        return { TEAM: 0, DIRECT: 1, REQUEST: 0, total: 1, requestCount: 0 };
      const tab = /tab=(\w+)/.exec(url)?.[1];
      if (tab) return { items: byTab[tab] ?? [], nextCursor: null };
      return undefined;
    });
  }

  it('opens on right-click, marks read up to the preview and leaves a 1:1 after confirming', async () => {
    const user = userEvent.setup();
    serve({ DIRECT: [direct] });
    renderWithProviders(<ChatList />, {
      viewer: { role: 'developer', login: 'developer' },
      searchParams: '?tab=DIRECT',
    });
    const article = (await screen.findByRole('heading', { name: '이도윤' })).closest('article')!;
    fireEvent.contextMenu(article);
    const sheet = await screen.findByRole('dialog', { name: '이도윤님과의 채팅방' });
    expect(within(sheet).getByRole('button', { name: '방 나가기' })).toBeEnabled();
    expect(within(sheet).queryByRole('button', { name: '상단 고정' })).not.toBeInTheDocument();
    expect(await axe(sheet)).toHaveNoViolations();

    await user.click(within(sheet).getByRole('button', { name: '읽음 처리' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/user/chat-rooms/5/read',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ lastReadMessageId: 31 }),
        }),
      ),
    );

    fireEvent.contextMenu(article);
    await user.click(
      within(await screen.findByRole('dialog', { name: '이도윤님과의 채팅방' })).getByRole(
        'button',
        {
          name: '방 나가기',
        },
      ),
    );
    const confirm = await screen.findByRole('alertdialog', { name: '대화에서 나갈까요?' });
    await user.click(within(confirm).getByRole('button', { name: '나가기' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/user/chat-rooms/5/members/me',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
  });

  it('offers 팀 나가기 on a long press and keeps the lift from opening the room', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      serve({ TEAM: [team] });
      renderWithProviders(<ChatList />, { viewer: { role: 'developer', login: 'developer' } });
      const link = await screen.findByRole('link', { name: /ShowMoa/ });
      fireEvent.pointerDown(link, { pointerType: 'touch' });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      const sheet = await screen.findByRole('dialog', { name: 'ShowMoa의 채팅방' });
      expect(within(sheet).getByRole('button', { name: '팀 나가기' })).toBeVisible();
      expect(within(sheet).getByRole('button', { name: '읽음 처리' })).toBeEnabled();
      // The browser's own long-press menu lands on the sheet now under the finger; it is cancelled
      expect(fireEvent.contextMenu(document.body)).toBe(false);
      fireEvent.pointerUp(link, { pointerType: 'touch' });
      // The click after the hold is swallowed; a later plain tap still navigates.
      expect(fireEvent.click(link)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives a sent request no menu and leaves the native context menu alone', async () => {
    serve({ REQUEST: [sent] });
    renderWithProviders(<ChatList />, {
      viewer: { role: 'developer', login: 'developer' },
      searchParams: '?tab=REQUEST',
    });
    const article = (await screen.findByRole('heading', { name: '김개발' })).closest('article')!;
    expect(fireEvent.contextMenu(article)).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
