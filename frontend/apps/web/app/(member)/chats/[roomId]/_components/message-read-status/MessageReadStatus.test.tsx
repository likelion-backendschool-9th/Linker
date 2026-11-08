import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { RoomMessage } from '../../_lib/room-api';
import { MessageReadStatus } from './MessageReadStatus';

const message: RoomMessage = { id: 1, roomId: 1, unreadCount: 2, sender: null, type: 'TEXT', text: '대화', imageUrls: [], payload: null, createdAt: '2026-11-03T00:00:00Z', editedAt: null, deletedAt: null, clientMessageId: null, visibility: 'VISIBLE', updatedAt: '2026-11-01T00:00:00Z' };
it('shows the team unread count and opens its message-specific list', async () => {
  const onUnread = vi.fn();
  render(<MessageReadStatus message={message} kind="TEAM" mine={false} onUnread={onUnread} />);
  const count = screen.getByRole('button', { name: '안 읽은 사람 2명' });
  expect(count).toHaveTextContent(/^2$/);
  await userEvent.click(count);
  expect(onUnread).toHaveBeenCalledWith(1);
});
it('switches own direct message from unread to read after the server count changes', () => {
  const { rerender } = render(<MessageReadStatus message={{ ...message, unreadCount: 1 }} kind="DIRECT" mine />);
  expect(screen.getByText('안 읽음')).toBeVisible();
  rerender(<MessageReadStatus message={{ ...message, unreadCount: 0 }} kind="DIRECT" mine />);
  expect(screen.getByText('읽음')).toBeVisible();
});
it('does not display the recipient status on incoming direct messages or pending requests', () => {
  const { container, rerender } = render(<MessageReadStatus message={message} kind="DIRECT" mine={false} />);
  expect(container).toBeEmptyDOMElement();
  rerender(<MessageReadStatus message={message} kind="REQUEST" mine />);
  expect(container).toBeEmptyDOMElement();
});
it.each([{ deletedAt: '2026-11-03' }, { visibility: 'HIDDEN' as const }, { type: 'SYSTEM' as const }, { type: 'PR_EVENT' as const }])('hides read details on unavailable and system messages', (state) => {
  const { container } = render(<MessageReadStatus message={{ ...message, ...state }} kind="TEAM" mine />);
  expect(container).toBeEmptyDOMElement();
});
it('never turns missing receipt data into an everyone-read confirmation', () => {
  render(<MessageReadStatus message={{ ...message, unreadCount: Number.NaN }} kind="TEAM" mine />);
  expect(screen.getByText('읽음 상태를 확인할 수 없어요.')).toBeVisible();
  expect(screen.queryByText('모두 읽음')).not.toBeInTheDocument();
});
