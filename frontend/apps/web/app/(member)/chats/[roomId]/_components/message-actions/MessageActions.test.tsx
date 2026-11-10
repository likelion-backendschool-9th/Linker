import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import type { RoomInfo, RoomMessage } from '../../_lib/room-api';
import { MessageActions } from './MessageActions';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);
const room: RoomInfo = { id: 1, kind: 'DIRECT', title: '대화', requestDirection: null, muted: false, members: [], team: null, historyLimitDays: null };
const message = (): RoomMessage => ({
  id: 10, roomId: 1, unreadCount: 0, sender: { id: 1, login: 'me', name: '나', avatarUrl: '' },
  type: 'TEXT', text: '원래 메시지', imageUrls: [], payload: null,
  createdAt: new Date().toISOString(), editedAt: null, deletedAt: null, clientMessageId: null, visibility: 'VISIBLE', updatedAt: '2026-11-01T00:00:00Z',
});
beforeEach(() => { fetchMock.mockReset(); });

it('opens the edit sheet and saves normalized text through the room message API', async () => {
  fetchMock.mockResolvedValue(undefined);
  const user = userEvent.setup();
  renderWithProviders(<MessageActions room={room} messages={[message()]} login="me" disabled={false} />, { searchParams: '?overlay=chat-message&oid=10' });
  await user.click(screen.getByRole('button', { name: '수정' }));
  const input = await screen.findByRole('textbox', { name: '메시지' });
  await user.clear(input);
  await user.type(input, '  고친 메시지  ');
  await user.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/chat-rooms/1/messages/10', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ text: '고친 메시지' }) })));
});
it('requires confirmation before deleting and preserves the sheet on failure', async () => {
  fetchMock.mockRejectedValue(new Error('offline'));
  const user = userEvent.setup();
  renderWithProviders(<MessageActions room={room} messages={[message()]} login="me" disabled={false} />, { searchParams: '?overlay=chat-message&oid=10' });
  await user.click(screen.getByRole('button', { name: '삭제' }));
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await screen.findByText('메시지를 삭제할까요?')).toBeVisible();
  await user.click(screen.getByRole('button', { name: '삭제' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('메시지를 변경하지 못했어요');
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/chat-rooms/1/messages/10', { method: 'DELETE' });
});
it('opens the shared report sheet with a DM target for another author', async () => {
  const onUrlUpdate = vi.fn();
  const user = userEvent.setup();
  renderWithProviders(<MessageActions room={room} messages={[message()]} login="other" disabled={false} />, { searchParams: '?overlay=chat-message&oid=10', onUrlUpdate });
  expect(screen.queryByRole('button', { name: '수정' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '신고' }));
  await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
  expect(onUrlUpdate.mock.calls.at(-1)![0].queryString).toContain('DM_MESSAGE');
});
it('copies message text to the clipboard', async () => {
  const user = userEvent.setup();
  renderWithProviders(<MessageActions room={room} messages={[message()]} login="me" disabled={false} />, { searchParams: '?overlay=chat-message&oid=10' });
  await user.click(screen.getByRole('button', { name: '복사' }));
  expect(await navigator.clipboard.readText()).toBe('원래 메시지');
});
