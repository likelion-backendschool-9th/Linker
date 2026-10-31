import { orderedMessages, type RoomMessage } from './room-api';

const message = (id: number, text: string): RoomMessage => ({
  id,
  roomId: 1,
  sender: null,
  type: 'TEXT',
  text,
  imageUrls: [],
  payload: null,
  createdAt: '2026-11-01T00:00:00Z',
  editedAt: null,
  deletedAt: null,
});
it('keeps message order and the newest version when REST and realtime pages overlap', () => {
  expect(
    orderedMessages([
      { items: [message(3, 'new'), message(2, 'edited')], hasMore: true },
      { items: [message(1, 'old'), message(2, 'original')], hasMore: false },
    ]).map(({ id, text }) => ({ id, text })),
  ).toEqual([
    { id: 1, text: 'old' },
    { id: 2, text: 'edited' },
    { id: 3, text: 'new' },
  ]);
});
