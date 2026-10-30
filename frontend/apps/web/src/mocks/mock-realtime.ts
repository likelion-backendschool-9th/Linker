import { nextMessageId, MESSAGES, UNREAD, type MockMessage } from './fixtures/chat';
import { brief, ME } from './fixtures/users';
import './routes';

/**
 * Stand-in for the STOMP connection while mocks are on (blueprint §1-2). Sending to
 * `/app/chat-rooms/{id}/messages` appends to the mock chat and fans out on `/topic/chat-rooms/{id}`
 * in this tab only, so chat feels live without a server. Other destinations accept subscriptions and stay quiet.
 */

type Listener = (body: unknown) => void;
const listeners = new Map<string, Set<Listener>>();

export function subscribe(destination: string, onMessage: Listener): () => void {
  const set = listeners.get(destination) ?? new Set<Listener>();
  set.add(onMessage);
  listeners.set(destination, set);
  return () => set.delete(onMessage);
}

function emit(destination: string, body: unknown) {
  listeners.get(destination)?.forEach((listener) => listener(body));
}

const SEND = /^\/app\/chat-rooms\/(\d+)\/messages$/;

export function publish(destination: string, body: unknown): boolean {
  const match = SEND.exec(destination);
  if (!match) return false;
  const roomId = Number(match[1]);
  const payload = body as { text?: string; imageUrls?: string[] };
  const message: MockMessage = {
    id: nextMessageId(),
    roomId,
    sender: brief(ME),
    type: payload.imageUrls?.length ? 'IMAGE' : 'TEXT',
    text: payload.text ?? null,
    imageUrls: payload.imageUrls ?? [],
    payload: null,
    createdAt: new Date().toISOString(),
    editedAt: null,
    deletedAt: null,
  };
  MESSAGES.push(message);
  emit(`/topic/chat-rooms/${roomId}`, { event: 'MESSAGE', message });

  // A teammate answers a moment later so the receive path is easy to see
  setTimeout(() => {
    const reply: MockMessage = {
      id: nextMessageId(),
      roomId,
      sender: { ...brief(ME), id: 2, login: 'doyun-lee', name: '이도윤' },
      type: 'TEXT',
      text: '확인했어요!',
      imageUrls: [],
      payload: null,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
    };
    MESSAGES.push(reply);
    UNREAD[roomId] = 0;
    emit(`/topic/chat-rooms/${roomId}`, { event: 'MESSAGE', message: reply });
  }, 1200);
  return true;
}
