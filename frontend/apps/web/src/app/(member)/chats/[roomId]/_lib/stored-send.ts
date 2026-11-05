/** Sender-only replay of a row that is already stored. Not a topic broadcast. */
export type StoredSendEvent = {
  type?: string;
  roomId?: number;
  clientMessageId?: string;
};

export function storedSendClientId(event: StoredSendEvent, roomId: number): string | null {
  if (event.type !== 'CHAT_SEND_ACCEPTED' || event.roomId !== roomId || !event.clientMessageId) return null;
  return event.clientMessageId;
}
