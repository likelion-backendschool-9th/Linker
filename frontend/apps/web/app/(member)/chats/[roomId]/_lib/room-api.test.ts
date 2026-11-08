import { QueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/api-fetch';

import { loadAfter, messagesOptions, messagesKey, mergeCatchUpHistory, orderedMessages, type RoomMessage } from './room-api';

const message = (id: number, text: string): RoomMessage => ({
  id,
  roomId: 1, unreadCount: 0,
  sender: null,
  type: 'TEXT',
  text,
  imageUrls: [],
  payload: null,
  createdAt: '2026-11-01T00:00:00Z',
  editedAt: null,
  deletedAt: null, clientMessageId: null, visibility: 'VISIBLE', updatedAt: '2026-11-01T00:00:00Z',
});
it('keeps message order and the newest version when REST and realtime pages overlap', () => {
  expect(
    orderedMessages([
      { items: [message(3, 'new'), { ...message(2, 'edited'), updatedAt: '2026-11-01T00:00:01Z' }], hasMore: true },
      { items: [message(1, 'old'), message(2, 'original')], hasMore: false },
    ]).map(({ id, text }) => ({ id, text })),
  ).toEqual([
    { id: 1, text: 'old' },
    { id: 2, text: 'edited' },
    { id: 3, text: 'new' },
  ]);
});

it('keeps the read anchor and all 501 missed messages with the oldest history cursor', () => {
  const result = mergeCatchUpHistory({
    pages: [{ items: [message(10, 'last read')], hasMore: true }], pageParams: [null],
  }, {
    items: Array.from({ length: 501 }, (_, index) => message(index + 11, 'missed')),
    hasMore: false,
  });
  expect(result.pages[0]!.items).toHaveLength(502);
  expect(result.pages[0]!.items[0]!.id).toBe(10);
  expect(result.pages[0]!.items.at(-1)!.id).toBe(511);
  expect(result.pages[0]!.hasMore).toBe(true);
});

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
it('keeps a large catch-up batch and its last-read anchor when read metadata is refreshed', async () => {
  const client = new QueryClient();
  const items = Array.from({ length: 501 }, (_, index) => message(index + 10, '대화'));
  client.setQueryData(messagesKey('me', 1), { pages: [{ items, hasMore: true }], pageParams: [null] });
  vi.mocked(apiFetch).mockResolvedValue({
    items: items.slice(1).map((item) => ({ ...item, unreadCount: 1 })), hasMore: false, catchUpLimited: false, nextAfter: null,
  });
  const result = await client.fetchInfiniteQuery(messagesOptions('me', 1));
  // `after` must be a message of this room, so the anchor itself is the cursor and stays from the cache.
  expect(apiFetch).toHaveBeenCalledWith('/api/v1/user/chat-rooms/1/messages?after=10', expect.anything());
  expect(result.pages[0]!.items).toHaveLength(501);
  expect(result.pages[0]!.items[0]!.id).toBe(10);
  expect(result.pages[0]!.items[1]!.unreadCount).toBe(1);
  expect(result.pages[0]!.hasMore).toBe(true);
  client.clear();
});

it('follows nextAfter past the 500 cap until every missed message is loaded', async () => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(apiFetch)
    .mockResolvedValueOnce({
      items: Array.from({ length: 500 }, (_, index) => message(index + 11, '1차')),
      hasMore: true, catchUpLimited: true, nextAfter: 510,
    })
    .mockResolvedValueOnce({
      items: Array.from({ length: 20 }, (_, index) => message(index + 511, '2차')),
      hasMore: false, catchUpLimited: false, nextAfter: null,
    });
  const page = await loadAfter(1, 10);
  expect(vi.mocked(apiFetch).mock.calls.map(([url]) => url)).toEqual([
    '/api/v1/user/chat-rooms/1/messages?after=10',
    '/api/v1/user/chat-rooms/1/messages?after=510',
  ]);
  expect(page.items).toHaveLength(520);
  expect(page.items.at(-1)!.id).toBe(530);
  expect(page.catchUpLimited).toBe(true);
});

it('stops when a capped batch does not advance the cursor', async () => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(apiFetch).mockResolvedValueOnce({ items: [], hasMore: true, catchUpLimited: true, nextAfter: 10 });
  const page = await loadAfter(1, 10);
  expect(apiFetch).toHaveBeenCalledTimes(1);
  expect(page.items).toEqual([]);
});
