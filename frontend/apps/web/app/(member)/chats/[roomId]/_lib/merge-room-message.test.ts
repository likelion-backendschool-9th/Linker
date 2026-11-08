import { mergeRoomMessage, type RoomMessage } from './room-api';

const base = (patch: Partial<RoomMessage>): RoomMessage => ({
  id: 10,
  roomId: 1,
  unreadCount: 0,
  clientMessageId: null,
  sender: null,
  type: 'TEXT',
  text: '원문',
  imageUrls: [],
  payload: null,
  createdAt: '2026-11-05T00:00:00Z',
  editedAt: null,
  deletedAt: null,
  visibility: 'VISIBLE',
  // Empty: a row from a server without the row version, which uses the direction rules below.
  updatedAt: '',
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

describe('with the row version', () => {
  const at = (micros: string) => `2026-11-05T00:00:00.${micros}Z`;

  it('accepts a restore that is newer than the hidden copy on screen', () => {
    const hidden = base({ text: '운영 정책에 따라 숨겨진 메시지예요', visibility: 'HIDDEN', updatedAt: at('000200') });
    const restored = base({ text: '신고 원문', updatedAt: at('000300') });
    expect(mergeRoomMessage(hidden, restored).text).toBe('신고 원문');
  });

  it('accepts an operator undelete that is newer than the deleted copy', () => {
    const deleted = base({ text: '삭제된 메시지입니다', deletedAt: at('000100'), updatedAt: at('000100') });
    const restored = base({ text: '복원된 원문', updatedAt: at('000150') });
    expect(mergeRoomMessage(deleted, restored).text).toBe('복원된 원문');
  });

  it('keeps a newer hide when a delayed older visible frame arrives', () => {
    const hidden = base({ text: '운영 정책에 따라 숨겨진 메시지예요', visibility: 'HIDDEN', updatedAt: at('000300') });
    const stale = base({ text: '신고 원문', updatedAt: at('000200') });
    expect(mergeRoomMessage(hidden, stale).visibility).toBe('HIDDEN');
  });

  it('keeps the latest state when an edit and a hide cross on the socket', () => {
    const edit = base({ text: '고친 글', editedAt: at('000100'), updatedAt: at('000100') });
    const hide = base({ text: '운영 정책에 따라 숨겨진 메시지예요', visibility: 'HIDDEN', editedAt: at('000100'), updatedAt: at('000200') });
    expect(mergeRoomMessage(edit, hide).visibility).toBe('HIDDEN');
    expect(mergeRoomMessage(hide, edit).visibility).toBe('HIDDEN');
  });

  it('keeps what is on screen for the same version', () => {
    const first = base({ text: '화면', updatedAt: at('000100') });
    const second = base({ text: '같은 버전', updatedAt: at('000100') });
    expect(mergeRoomMessage(first, second).text).toBe('화면');
  });
});
