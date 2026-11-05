import { storedSendClientId } from './stored-send';

it('returns the client id only for this room', () => {
  expect(storedSendClientId({ type: 'CHAT_SEND_ACCEPTED', roomId: 4, clientMessageId: 'abc' }, 4)).toBe('abc');
  expect(storedSendClientId({ type: 'CHAT_SEND_ACCEPTED', roomId: 9, clientMessageId: 'abc' }, 4)).toBeNull();
  expect(storedSendClientId({ type: 'CHAT_SEND_REJECTED', roomId: 4, clientMessageId: 'abc' }, 4)).toBeNull();
  expect(storedSendClientId({ type: 'CHAT_SEND_ACCEPTED', roomId: 4 }, 4)).toBeNull();
});
