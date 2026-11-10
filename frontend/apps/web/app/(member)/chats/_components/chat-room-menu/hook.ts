import type { ChatRoom } from './api';

/** Figma-less title, following the reference "ShowMoa의 채팅방" */
export function menuTitle(room: ChatRoom) {
  if (!room.title) return '채팅방';
  return room.kind === 'TEAM' ? `${room.title}의 채팅방` : `${room.title}님과의 채팅방`;
}

/**
 * What the sheet offers per tab. TEAM leaves through team settings (09, Policy: leaving the team
 * leaves its chat); DIRECT leaves the 1:1; a received request's "나가기" is the existing delete.
 * Sent requests get no menu at all (see `hasRoomMenu`).
 */
export function roomMenuItems(room: ChatRoom) {
  const leave = room.kind === 'TEAM' ? (room.teamId != null ? '팀 나가기' : null) : '방 나가기';
  return { leave, read: room.unreadCount > 0 && room.lastMessage != null };
}

export function hasRoomMenu(room: ChatRoom) {
  return !(room.kind === 'REQUEST' && room.requestDirection === 'SENT');
}
