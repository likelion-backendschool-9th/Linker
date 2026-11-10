import { fireEvent, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/test/render-with-providers';
import type { RoomMessage } from '../../_lib/room-api';
import { ChatMessage } from '../chat-message/ChatMessage';

const card = {
  targetType: 'POST',
  targetId: 42,
  title: 'linker/web',
  summary: '프로젝트 소개 · 한서준',
  imageUrl: '/mock/cover-1.svg',
  linkPath: '/posts/42?from=chat_share',
  available: true,
};
const message: RoomMessage = {
  id: 100,
  roomId: 1,
  unreadCount: 0,
  sender: { id: 1, login: 'seojun', name: '한서준', avatarUrl: null },
  type: 'SHARE_CARD',
  text: null,
  imageUrls: [],
  payload: card,
  createdAt: '2026-11-08T00:00:00Z',
  editedAt: null,
  deletedAt: null, clientMessageId: null, visibility: 'VISIBLE', updatedAt: '2026-11-01T00:00:00Z',
};

it('renders one card link for both an explicit share and a pasted Linker URL without requiring mutual follows', async () => {
  const { container, unmount } = renderWithProviders(
    <ChatMessage message={message} mine kind="DIRECT" />,
  );
  expect(
    screen.getByRole('link', { name: '게시물: linker/web, 프로젝트 소개 · 한서준' }),
  ).toHaveAttribute('href', '/posts/42?from=chat_share');
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(await axe(container)).toHaveNoViolations();
  unmount();
  renderWithProviders(
    <ChatMessage
      message={{ ...message, type: 'TEXT', text: '공유해요', payload: { linkerCard: card } }}
      mine
      kind="DIRECT"
    />,
  );
  expect(screen.getByRole('link', { name: /게시물: linker\/web/ })).toHaveAttribute(
    'href',
    '/posts/42?from=chat_share',
  );
});

it.each(['SHARE_CARD', 'TEXT'] as const)(
  'shows unavailable %s cards as text without stale metadata or links',
  (type) => {
    const unavailable = { ...card, available: false };
    renderWithProviders(
      <ChatMessage
        message={{
          ...message,
          type,
          payload: type === 'TEXT' ? { linkerCard: unavailable } : unavailable,
        }}
        mine
        kind="TEAM"
      />,
    );
    expect(screen.getByText('볼 수 없는 게시물이에요')).toBeVisible();
    expect(screen.queryByText('linker/web')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  },
);

it.each([{ deletedAt: '2026-11-08T01:00:00Z' }, { visibility: 'HIDDEN' as const }])(
  'does not reveal cards on deleted/hidden messages',
  (state) => {
    renderWithProviders(<ChatMessage message={{ ...message, ...state }} mine kind="TEAM" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText('linker/web')).not.toBeInTheDocument();
  },
);

it('keeps Enter on the card link separate from the message menu shortcut', () => {
  const onMenu = vi.fn();
  renderWithProviders(<ChatMessage message={message} mine kind="TEAM" onMenu={onMenu} />);
  fireEvent.keyDown(screen.getByRole('link'), { key: 'Enter' });
  expect(onMenu).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole('group', { name: '한서준 메시지' }), { key: 'Enter' });
  expect(onMenu).toHaveBeenCalledWith(100);
});
