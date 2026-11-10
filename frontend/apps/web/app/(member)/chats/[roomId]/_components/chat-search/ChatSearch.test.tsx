import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test/render-with-providers';

import type { RoomMessage } from '../../_lib/room-api';
import { useChatSearchStore } from '../../_lib/chat-search-store';
import { ChatSearch } from './ChatSearch';
import { searchChatMessages } from './api';

vi.mock('./api', () => ({ searchChatMessages: vi.fn() }));
const searchMock = vi.mocked(searchChatMessages);

const message = (id: number): RoomMessage => ({
  id,
  roomId: 7,
  unreadCount: 0,
  clientMessageId: null,
  sender: null,
  type: 'TEXT',
  text: `검색 메시지 ${id}`,
  imageUrls: [],
  payload: null,
  createdAt: '2026-11-10T00:00:00Z',
  editedAt: null,
  deletedAt: null,
  visibility: 'VISIBLE',
  updatedAt: '2026-11-10T00:00:00Z',
});

beforeEach(() => {
  useChatSearchStore.setState({ openRoomId: 7 });
  searchMock.mockReset();
  searchMock.mockResolvedValue({ items: [message(30), message(20), message(10)], history: null });
});

it('starts at the newest result and moves to older and newer matches', async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  renderWithProviders(<ChatSearch roomId={7} onSelect={onSelect} />);

  await user.type(screen.getByRole('searchbox', { name: '검색어' }), '디자인');
  await waitFor(() =>
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 30 }), '디자인'),
  );
  expect(screen.getByText('1/3')).toBeVisible();

  await user.click(screen.getByRole('button', { name: '이전 검색 결과' }));
  expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 20 }), '디자인');
  expect(screen.getByText('2/3')).toBeVisible();

  await user.click(screen.getByRole('button', { name: '다음 검색 결과' }));
  expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 30 }), '디자인');
});

it('clears the selected result when search closes', async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  renderWithProviders(<ChatSearch roomId={7} onSelect={onSelect} />);
  await user.click(screen.getByRole('button', { name: '검색 닫기' }));
  await waitFor(() => expect(onSelect).toHaveBeenLastCalledWith(null));
});
