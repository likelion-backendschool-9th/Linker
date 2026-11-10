import { rejectedSend, storedSendClientId } from './stored-send';

it('returns the client id only for this room', () => {
  expect(storedSendClientId({ type: 'CHAT_SEND_ACCEPTED', roomId: 4, clientMessageId: 'abc' }, 4)).toBe('abc');
  expect(storedSendClientId({ type: 'CHAT_SEND_ACCEPTED', roomId: 9, clientMessageId: 'abc' }, 4)).toBeNull();
  expect(storedSendClientId({ type: 'CHAT_SEND_REJECTED', roomId: 4, clientMessageId: 'abc' }, 4)).toBeNull();
  expect(storedSendClientId({ type: 'CHAT_SEND_ACCEPTED', roomId: 4 }, 4)).toBeNull();
});

it('keeps a rejection for this room and does not treat it as stored', () => {
  expect(rejectedSend({ type: 'CHAT_SEND_REJECTED', roomId: 4, clientMessageId: 'abc', retryable: false }, 4))
    .toEqual({ clientMessageId: 'abc', retryable: false });
  expect(rejectedSend({ type: 'CHAT_SEND_REJECTED', roomId: 4, clientMessageId: 'abc', retryable: true }, 4))
    .toEqual({ clientMessageId: 'abc', retryable: true });
  expect(rejectedSend({ type: 'CHAT_SEND_REJECTED', roomId: 9, clientMessageId: 'abc' }, 4)).toBeNull();
  expect(rejectedSend({ type: 'CHAT_SEND_ACCEPTED', roomId: 4, clientMessageId: 'abc' }, 4)).toBeNull();
});
