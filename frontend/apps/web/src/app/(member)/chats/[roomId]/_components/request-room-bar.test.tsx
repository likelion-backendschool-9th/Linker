import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import type { RoomInfo } from '../_lib/room-api';
import { RequestRoomBar } from './request-room-bar';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);
const push = vi.fn();

const room: RoomInfo = {
  id: 21,
  kind: 'REQUEST',
  title: '최민재',
  requestDirection: 'RECEIVED',
  muted: false,
  members: [],
  team: null,
  historyLimitDays: null,
};

beforeEach(() => {
  fetchMock.mockReset();
  push.mockReset();
  vi.spyOn(window.history, 'back').mockImplementation(() => {
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  vi.mocked(useRouter).mockReturnValue({
    bfcacheId: 'test',
    push,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  });
});

it('accepts the request in place', async () => {
  fetchMock.mockResolvedValue({ roomId: 21 });
  const user = userEvent.setup();
  renderWithProviders(<RequestRoomBar room={room} login="me" disabled={false} />);
  await user.click(screen.getByRole('button', { name: '최민재 요청 수락' }));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/chat-requests/21/accept', { method: 'POST' }),
  );
  expect(push).not.toHaveBeenCalled();
});

it('deletes only after confirmation and returns to the request list', async () => {
  fetchMock.mockResolvedValue(undefined);
  const user = userEvent.setup();
  renderWithProviders(<RequestRoomBar room={room} login="me" disabled={false} />);
  await user.click(screen.getByRole('button', { name: '최민재 요청 삭제' }));
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await screen.findByRole('heading', { name: '메시지 요청을 삭제할까요?' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: '삭제' }));
  await waitFor(() => expect(push).toHaveBeenCalledWith('/chats?tab=REQUEST'));
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/chat-requests/21', { method: 'DELETE' });
});

it('keeps the confirmation open when deletion fails', async () => {
  fetchMock.mockRejectedValue(new Error('offline'));
  const user = userEvent.setup();
  renderWithProviders(<RequestRoomBar room={room} login="me" disabled={false} />);
  await user.click(screen.getByRole('button', { name: '최민재 요청 삭제' }));
  await user.click(await screen.findByRole('button', { name: '삭제' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('요청을 처리하지 못했어요');
  expect(push).not.toHaveBeenCalled();
});
