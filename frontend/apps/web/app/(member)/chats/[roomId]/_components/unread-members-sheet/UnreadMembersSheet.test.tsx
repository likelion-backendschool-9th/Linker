import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import type { RoomInfo, RoomMessage } from '../../_lib/room-api';
import { UnreadMembersSheet } from './UnreadMembersSheet';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);
const room: RoomInfo = { id: 1, kind: 'TEAM', title: '팀', requestDirection: null, muted: false, members: [], team: null, historyLimitDays: null };
const message: RoomMessage = { id: 10, roomId: 1, unreadCount: 1, sender: null, type: 'TEXT', text: '대화', imageUrls: [], payload: null, createdAt: '2026-11-03T00:00:00Z', editedAt: null, deletedAt: null, clientMessageId: null, visibility: 'VISIBLE', updatedAt: '2026-11-01T00:00:00Z' };
beforeEach(() => { fetchMock.mockReset(); });
it('does not request a list until the sheet is open', () => {
  renderWithProviders(<UnreadMembersSheet room={room} messages={[message]} login="me" />);
  expect(fetchMock).not.toHaveBeenCalled();
});
it('loads only the selected message and displays its unread members', async () => {
  fetchMock.mockResolvedValue({ items: [{ id: 2, name: '이도윤', login: 'doyun', avatarUrl: '' }] });
  renderWithProviders(<UnreadMembersSheet room={room} messages={[message]} login="me" />, { searchParams: '?overlay=chat-unread&oid=10' });
  expect(await screen.findByText('이도윤')).toBeVisible();
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/chat-rooms/1/messages/10/unread-members', expect.objectContaining({ cache: 'no-store' }));
});
it('allows retry after a failed request and shows the everyone-read state', async () => {
  fetchMock.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ items: [] });
  renderWithProviders(<UnreadMembersSheet room={room} messages={[message]} login="me" />, { searchParams: '?overlay=chat-unread&oid=10' });
  await screen.findByText('참여자를 불러오지 못했어요');
  await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  expect(await screen.findByText('모두 읽었어요.')).toBeVisible();
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
});
it('does not fetch members for a hidden message or a direct room, including a URL entered manually', () => {
  renderWithProviders(<UnreadMembersSheet room={{ ...room, kind: 'DIRECT' }} messages={[message]} login="me" />, { searchParams: '?overlay=chat-unread&oid=10' });
  expect(screen.getByText('읽음 상태를 확인할 수 없는 메시지예요.')).toBeVisible();
  expect(fetchMock).not.toHaveBeenCalled();
});
