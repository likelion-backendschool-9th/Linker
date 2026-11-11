import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import { NotificationList } from './NotificationList';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);
const notice = {
  id: 1,
  type: 'CHAT',
  title: '팀 채팅',
  body: '새 메시지',
  targetUrl: '/chats/1',
  read: false,
  createdAt: '2026-11-01T00:00:00Z',
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url) =>
    url.endsWith('unread-count') ? { count: 1 } : { items: [notice], nextCursor: null },
  );
});
it('marks all read, updates the count, and exposes readable status with no axe violations', async () => {
  const { container } = renderWithProviders(<NotificationList />, {
    viewer: { role: 'developer', login: 'developer' },
  });
  await screen.findByRole('link', { name: /^읽지 않음,\s*팀 채팅 새 메시지$/ });
  expect(await axe(container)).toHaveNoViolations();
  fetchMock.mockImplementation(async (url) =>
    url.endsWith('unread-count')
      ? { count: 0 }
      : { items: [{ ...notice, read: true }], nextCursor: null },
  );
  await userEvent.click(screen.getByRole('button', { name: '전체 읽기' }));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/notifications/read-all', {
      method: 'POST',
    }),
  );
  await screen.findByText('읽지 않은 알림 0개');
  expect(await screen.findByRole('link', { name: '팀 채팅 새 메시지' })).toBeVisible();
  expect(screen.getByRole('button', { name: '전체 읽기' })).toBeDisabled();
});
it('shows the title and body of each row, grouped under its day', async () => {
  renderWithProviders(<NotificationList />, { viewer: { role: 'developer', login: 'developer' } });
  await screen.findByRole('link', { name: /^읽지 않음,\s*팀 채팅 새 메시지$/ });
  expect(screen.getByText('새 메시지')).toBeVisible();
  expect(screen.getByRole('heading', { level: 2, name: /11월 1일/ })).toBeVisible();
});
it('asks the server for unread rows on the "읽지 않음" tab and keeps the tab in the URL', async () => {
  const onUrlUpdate = vi.fn();
  renderWithProviders(<NotificationList />, {
    viewer: { role: 'developer', login: 'developer' },
    onUrlUpdate,
  });
  expect(await screen.findByRole('button', { name: '전체' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await userEvent.click(screen.getByRole('button', { name: '읽지 않음' }));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/user/notifications?unread=true',
      expect.anything(),
    ),
  );
  expect(onUrlUpdate).toHaveBeenLastCalledWith(
    expect.objectContaining({ queryString: '?tab=unread' }),
  );
  expect(screen.getByRole('button', { name: '읽지 않음' })).toHaveAttribute('aria-current', 'page');
});
it('says when there is nothing unread', async () => {
  fetchMock.mockImplementation(async (url) =>
    url.endsWith('unread-count') ? { count: 0 } : { items: [], nextCursor: null },
  );
  renderWithProviders(<NotificationList />, {
    viewer: { role: 'developer', login: 'developer' },
    searchParams: '?tab=unread',
  });
  expect(await screen.findByText('읽지 않은 알림이 없어요.')).toBeVisible();
});
it('keeps the list and a retry action when marking an item read fails', async () => {
  renderWithProviders(<NotificationList />, { viewer: { role: 'developer', login: 'developer' } });
  const link = await screen.findByRole('link', { name: /팀 채팅/ });
  fetchMock.mockImplementation(async (url) => {
    if (url.endsWith('/read')) throw new Error('offline');
    return url.endsWith('unread-count') ? { count: 1 } : { items: [notice], nextCursor: null };
  });
  await userEvent.click(link);
  expect(await screen.findByText('읽음 상태를 저장하지 못했어요')).toBeVisible();
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeVisible();
});
it('shows a useful empty state', async () => {
  fetchMock.mockImplementation(async (url) =>
    url.endsWith('unread-count') ? { count: 0 } : { items: [], nextCursor: null },
  );
  renderWithProviders(<NotificationList />, { viewer: { role: 'developer', login: 'developer' } });
  expect(await screen.findByText('아직 알림이 없어요.')).toBeVisible();
});
