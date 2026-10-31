import { MOCK_ROLE_COOKIE, parseMockRole } from '@/lib/auth/mock-viewer';
import { CHAT } from '@/lib/policy';
import { countChars } from '@/lib/format/text';
import { buildViewer } from './core/viewer';
import { findTeam } from './fixtures/teams';
import { emit } from './realtime-bus';
import { findRoom, nextMessageId, MESSAGES, UNREAD, type MockMessage } from './fixtures/chat';
import { brief, ME } from './fixtures/users';
import './routes';

/**
 * Stand-in for the STOMP connection while mocks are on (blueprint §1-2). Sending to
 * `/app/chat-rooms/{id}/messages` appends to the mock chat and fans out on `/topic/chat-rooms/{id}`
 * in this tab only, so chat feels live without a server. Other destinations accept subscriptions and stay quiet.
 */

export { subscribe } from './realtime-bus';

const SEND = /^\/app\/chat-rooms\/(\d+)\/messages$/;

export function publish(destination: string, body: unknown): boolean {
  const match = SEND.exec(destination);
  if (!match) return false;
  const roomId = Number(match[1]);
  const payload = body as { clientMessageId?: string; text?: string; imageUrls?: string[] };
  const cookie = document.cookie.match(new RegExp(`(?:^|; )${MOCK_ROLE_COOKIE}=([^;]*)`));
  const viewer = buildViewer(parseMockRole(cookie?.[1]));
  const room = findRoom(String(roomId));
  if (!viewer.me || !room || room.kind === 'REQUEST') return false;
  if (room.teamId && findTeam(room.teamId)?.status !== 'ACTIVE') return false;
  if (!payload.text?.trim() || countChars(payload.text) > CHAT.messageMax) return false;
  const existing =
    payload.clientMessageId &&
    MESSAGES.find(
      (item) =>
        item.clientMessageId === payload.clientMessageId && item.sender?.id === viewer.me!.id,
    );
  if (existing) {
    emit(`/topic/chat-rooms/${roomId}`, { event: 'MESSAGE', message: existing });
    return true;
  }
  const message: MockMessage = {
    id: nextMessageId(),
    roomId,
    sender: brief(viewer.me),
    clientMessageId: payload.clientMessageId,
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
  emit('/user/queue/chat-rooms', { event: 'MESSAGE', roomId });

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
    UNREAD[roomId] = (UNREAD[roomId] ?? 0) + 1;
    emit(`/topic/chat-rooms/${roomId}`, { event: 'MESSAGE', message: reply });
    emit('/user/queue/chat-rooms', { event: 'MESSAGE', roomId });
  }, 1200);
  return true;
}
