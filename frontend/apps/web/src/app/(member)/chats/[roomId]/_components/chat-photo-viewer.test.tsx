import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test/render-with-providers';

import type { RoomMessage } from '../_lib/room-api';
import { ChatPhotoViewer } from './chat-photo-viewer';

const message: RoomMessage = {
  id: 100, roomId: 1, unreadCount: 0, sender: null, type: 'IMAGE', text: null,
  imageUrls: ['/mock/cover-1.svg', '/mock/cover-2.svg'], payload: null,
  createdAt: '2026-11-03T00:00:00Z', editedAt: null, deletedAt: null,
};
it('opens the selected image and keeps its message ID while changing photos with replace', async () => {
  const user = userEvent.setup();
  const onUrlUpdate = vi.fn();
  renderWithProviders(<ChatPhotoViewer messages={[message]} />, { searchParams: '?overlay=chat-photo&oid=100:1', onUrlUpdate });
  expect(screen.getByRole('heading', { name: '사진 2/2' })).toBeVisible();
  expect(screen.getByRole('img', { name: '채팅 이미지 2' })).toHaveAttribute('src', '/mock/cover-2.svg');
  await user.click(screen.getByRole('button', { name: '앞으로' }));
  await waitFor(() => expect(screen.getByRole('heading', { name: '사진 1/2' })).toBeVisible());
  expect(new URLSearchParams(onUrlUpdate.mock.calls.at(-1)![0].queryString).get('oid')).toBe('100:0');
  expect(onUrlUpdate.mock.calls.at(-1)![0].options.history).toBe('replace');
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
it.each([{ deletedAt: '2026-11-03T01:00:00Z' }, { visibility: 'HIDDEN' as const }, { visibility: 'UNDER_REVIEW' as const }])('does not reveal removed or hidden image URLs', (state) => {
  renderWithProviders(<ChatPhotoViewer messages={[{ ...message, ...state }]} />, { searchParams: '?overlay=chat-photo&oid=100:0' });
  expect(screen.getByText('사진을 볼 수 없어요')).toBeVisible();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
