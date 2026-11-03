import { findRoom, type MockMessage } from './chat';
import { TEAM_MEMBERS } from './teams';
import { brief, ME } from './users';

/** Per-room participant watermarks; shared by REST history, unread members and STOMP. */
export const READ_POSITIONS = new Map<number, Map<number, number>>();

export function recordRead(roomId: number, userId: number, messageId: number) {
  let positions = READ_POSITIONS.get(roomId);
  if (!positions) {
    positions = new Map();
    READ_POSITIONS.set(roomId, positions);
  }
  positions.set(userId, Math.max(positions.get(userId) ?? 0, messageId));
}

export function unreadMembers(message: MockMessage) {
  const room = findRoom(message.roomId);
  if (!room) return [];
  const members = room.teamId ? (TEAM_MEMBERS[room.teamId] ?? []).map((member) => member.user) :
    [brief(ME), room.counterpart].filter((member) => member !== null);
  const unique = new Map(members.map((member) => [member.id, member]));
  return [...unique.values()].filter((member) => member.id !== message.sender?.id &&
    (READ_POSITIONS.get(message.roomId)?.get(member.id) ?? 0) < message.id);
}

export function withReadState(message: MockMessage) {
  return { ...message, unreadCount: unreadMembers(message).length };
}
