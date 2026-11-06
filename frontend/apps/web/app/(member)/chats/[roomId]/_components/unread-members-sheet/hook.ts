'use client';

import { useQuery } from '@tanstack/react-query';

import { useOverlay } from '@/lib/navigation/use-overlay';

import { unreadMembersOptions, type RoomInfo, type RoomMessage } from './api';

export function useUnreadMembersSheet({
  room,
  messages,
  login,
}: {
  room: RoomInfo;
  messages: RoomMessage[];
  login: string | null;
}) {
  const overlay = useOverlay('chat-unread');
  const message = messages.find((item) => String(item.id) === overlay.id);
  const available =
    room.kind === 'TEAM' &&
    !!message &&
    !message.deletedAt &&
    message.visibility !== 'HIDDEN' &&
    message.visibility !== 'UNDER_REVIEW' &&
    message.type !== 'SYSTEM' &&
    message.type !== 'PR_EVENT';
  const query = useQuery(unreadMembersOptions(login, room.id, available ? message.id : null));

  return { overlay, available, query };
}
