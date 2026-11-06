import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { act } from 'react';

import { ViewerProvider } from '@/lib/auth/viewer-context';

import { notificationKeys } from '../notification-queries';
import { NotificationRealtime } from './NotificationRealtime';

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

function renderRealtime(login: string | null = 'yunsu', role: 'developer' | 'guest' = 'developer') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <ViewerProvider viewer={{ role, login, status: role === 'guest' ? null : 'ACTIVE', suspendedUntil: null }}>
        <NotificationRealtime />
      </ViewerProvider>
    </QueryClientProvider>,
  );
  return { invalidate };
}

beforeEach(() => subscribe.mockClear());

it('subscribes to the notifications user queue for signed-in members', () => {
  renderRealtime();
  expect(subscribe).toHaveBeenCalledWith(
    expect.objectContaining({ destination: '/user/queue/notifications' }),
  );
});

it('does not subscribe for guests', () => {
  renderRealtime(null, 'guest');
  expect(subscribe).not.toHaveBeenCalled();
});

it('invalidates the notification account cache on message and resubscribe', () => {
  const { invalidate } = renderRealtime('yunsu');
  expect(subscribe).toHaveBeenCalled();
  const entry = subscribe.mock.calls[0]![0];

  act(() => entry.onMessage());
  act(() => entry.onResubscribe?.());

  expect(invalidate).toHaveBeenCalledWith({ queryKey: notificationKeys.account('yunsu') });
  expect(invalidate).toHaveBeenCalledTimes(2);
});
