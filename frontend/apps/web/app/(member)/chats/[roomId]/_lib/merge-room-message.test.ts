import { mergeRoomMessage, type RoomMessage } from './room-api';

const base = (patch: Partial<RoomMessage>): RoomMessage => ({
  id: 10,
  roomId: 1,
  unreadCount: 0,
  sender: null,
  type: 'TEXT',
  text: '원문',
  imageUrls: [],
  payload: null,
  createdAt: '2026-11-05T00:00:00Z',
  editedAt: null,
  deletedAt: null,
  visibility: 'VISIBLE',
  ...patch,
});

it('keeps a delete ahead of a delayed edit or message', () => {
  const deleted = base({ text: '삭제된 메시지입니다', deletedAt: '2026-11-05T01:00:00Z' });
  expect(mergeRoomMessage(deleted, base({ text: '지연 수정', editedAt: '2026-11-05T00:30:00Z' })).text).toBe('삭제된 메시지입니다');
  expect(mergeRoomMessage(deleted, base({ text: '지연 메시지' })).text).toBe('삭제된 메시지입니다');
});

it('keeps the newer edit when an older edit arrives later', () => {
  const newer = base({ text: '최신', editedAt: '2026-11-05T02:00:00Z' });
  const older = base({ text: '과거', editedAt: '2026-11-05T01:00:00Z' });
  expect(mergeRoomMessage(newer, older).text).toBe('최신');
  expect(mergeRoomMessage(older, newer).text).toBe('최신');
});

it('orders edits that differ only by microseconds inside one millisecond', () => {
  const earlier = base({ text: '같은 밀리초의 과거', editedAt: '2026-11-05T00:00:00.123456Z' });
  const later = base({ text: '같은 밀리초의 최신', editedAt: '2026-11-05T00:00:00.123789Z' });
  expect(Date.parse(earlier.editedAt!)).toBe(Date.parse(later.editedAt!));
  expect(mergeRoomMessage(later, earlier).text).toBe('같은 밀리초의 최신');
  expect(mergeRoomMessage(earlier, later).text).toBe('같은 밀리초의 최신');
});

it('does not order two different bodies that share one microsecond', () => {
  const first = base({ text: '먼저 도착', editedAt: '2026-11-05T00:00:00.123456Z' });
  const second = base({ text: '같은 시각의 다른 본문', editedAt: '2026-11-05T00:00:00.123456Z' });
  expect(mergeRoomMessage(first, second).text).toBe('먼저 도착');
  expect(mergeRoomMessage(second, first).text).toBe('같은 시각의 다른 본문');
});

it('does not reveal a hidden message from an older visible snapshot', () => {
  const hidden = base({ text: '운영 정책에 따라 숨겨진 메시지예요', visibility: 'HIDDEN' });
  expect(mergeRoomMessage(hidden, base({ text: '신고 원문' })).text).toBe('운영 정책에 따라 숨겨진 메시지예요');
});
