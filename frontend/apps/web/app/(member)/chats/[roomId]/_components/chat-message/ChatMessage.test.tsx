import { screen } from '@testing-library/react';

import { renderWithProviders } from '@/test/render-with-providers';

import type { RoomMessage } from '../../_lib/room-api';
import { ChatMessage } from './ChatMessage';

const message = (text: string): RoomMessage => ({
  id: 1,
  roomId: 7,
  unreadCount: 0,
  clientMessageId: null,
  sender: null,
  type: 'TEXT',
  text,
  imageUrls: [],
  payload: null,
  createdAt: '2026-11-10T00:00:00Z',
  editedAt: null,
  deletedAt: null,
  visibility: 'VISIBLE',
  updatedAt: '2026-11-10T00:00:00Z',
});

it('marks every case-insensitive keyword match and keeps the rest of the text', () => {
  const { container } = renderWithProviders(
    <ChatMessage
      kind="TEAM"
      mine={false}
      message={message('PR 올렸어요. pr (1) 확인')}
      highlight="pr"
    />,
  );
  expect([...container.querySelectorAll('mark')].map((mark) => mark.textContent)).toEqual([
    'PR',
    'pr',
  ]);
  expect(screen.getByText(/올렸어요/)).toHaveTextContent('PR 올렸어요. pr (1) 확인');
});

it('treats regex characters in the keyword literally and marks nothing without a keyword', () => {
  const { container, rerender } = renderWithProviders(
    <ChatMessage kind="TEAM" mine={false} message={message('확인 (1) 완료')} highlight="(1)" />,
  );
  expect(container.querySelector('mark')).toHaveTextContent('(1)');
  rerender(<ChatMessage kind="TEAM" mine={false} message={message('확인 (1) 완료')} />);
  expect(container.querySelector('mark')).toBeNull();
});
