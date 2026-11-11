import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';

import { ViewerProvider } from '@/lib/auth/viewer-context';
import { getUnreadNotificationCount } from '@linker/api/p18-notifications/p18-notifications';
import { NotificationBell } from './NotificationBell';

vi.mock('@linker/api/p18-notifications/p18-notifications', () => ({
  getUnreadNotificationCount: vi.fn(),
}));

afterEach(() => {
  vi.useRealTimers();
  focusManager.setFocused(undefined);
});

it('recovers a new notification badge even when no WebSocket event arrives', async () => {
  vi.useFakeTimers();
  focusManager.setFocused(true);
  let count = 0;
  vi.mocked(getUnreadNotificationCount).mockImplementation(async () => ({ count }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <ViewerProvider viewer={{ role: 'developer', login: 'me', status: 'ACTIVE', suspendedUntil: null }}>
        <NotificationBell />
      </ViewerProvider>
    </QueryClientProvider>,
  );
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(screen.getByRole('link', { name: '알림' })).toBeInTheDocument();
  count = 1;
  await act(async () => { await vi.advanceTimersByTimeAsync(30_001); });
  expect(screen.getByRole('link', { name: '알림 (안 읽은 알림 있음)' })).toHaveAttribute('href', '/notifications');
  view.unmount();
  client.clear();
});
