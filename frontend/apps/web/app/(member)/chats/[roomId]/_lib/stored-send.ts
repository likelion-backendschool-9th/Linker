/** Sender-only replay of a row that is already stored. Not a topic broadcast. */
export type StoredSendEvent = {
  type?: string;
  roomId?: number;
  clientMessageId?: string;
  retryable?: boolean;
};

export function storedSendClientId(event: StoredSendEvent, roomId: number): string | null {
  if (event.type !== 'CHAT_SEND_ACCEPTED' || event.roomId !== roomId || !event.clientMessageId) return null;
  return event.clientMessageId;
}

/** A rejection keeps the pending row. `retryable` follows the server frame. */
export function rejectedSend(
  event: StoredSendEvent,
  roomId: number,
): { clientMessageId: string; retryable: boolean } | null {
  if (event.type !== 'CHAT_SEND_REJECTED' || event.roomId !== roomId || !event.clientMessageId) return null;
  return { clientMessageId: event.clientMessageId, retryable: event.retryable === true };
}
