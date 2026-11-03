import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { act } from 'react';

import { ViewerProvider } from '@/lib/auth/viewer-context';

import { ChatUnreadBadge } from './chat-unread-badge';
import { chatKeys } from './chat-queries';

type SubscribeEntry = {
  destination: string;
  onMessage: () => void;
  onResubscribe?: () => void;
};

const subscribe = vi.fn<(entry: SubscribeEntry) => void>();

vi.mock('@/lib/realtime/use-stomp', () => ({
  useStompSubscription: (
    destination: string,
    onMessage: () => void,
    options?: { onResubscribe?: () => void; enabled?: boolean },
  ) => {
    if (options?.enabled === false) return;
    subscribe({ destination, onMessage, onResubscribe: options?.onResubscribe });
  },
}));

vi.mock('@/lib/api/api-fetch', () => ({
  apiFetch: vi.fn(async () => ({
    TEAM: 0,
    DIRECT: 0,
    REQUEST: 0,
    requestCount: 0,
    total: 0,
  })),
}));

function renderBadge(login: string | null = 'yunsu', role: 'developer' | 'guest' = 'developer') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <ViewerProvider viewer={{ role, login, status: role === 'guest' ? null : 'ACTIVE', suspendedUntil: null }}>
        <ChatUnreadBadge />
      </ViewerProvider>
    </QueryClientProvider>,
  );
  return { invalidate };
}

beforeEach(() => subscribe.mockClear());

it('subscribes to the chat-rooms user queue for signed-in members', () => {
  renderBadge();
  expect(subscribe).toHaveBeenCalledWith(
    expect.objectContaining({ destination: '/user/queue/chat-rooms' }),
  );
});

it('does not subscribe for guests', () => {
  renderBadge(null, 'guest');
  expect(subscribe).not.toHaveBeenCalled();
});

it('invalidates the whole chat account cache on message and resubscribe', () => {
  const { invalidate } = renderBadge('yunsu');
  expect(subscribe).toHaveBeenCalled();
  const entry = subscribe.mock.calls[0]![0];

  act(() => entry.onMessage());
  act(() => entry.onResubscribe?.());

  expect(invalidate).toHaveBeenCalledWith({ queryKey: chatKeys.account('yunsu') });
  expect(invalidate).toHaveBeenCalledTimes(2);
});
