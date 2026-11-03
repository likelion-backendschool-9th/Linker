import { CHAT } from '@/lib/policy';

import type { RoomMessage } from './room-api';

export function messageActions(
  message: RoomMessage,
  login: string | null,
  teamRole: 'OWNER' | 'ADMIN' | 'MEMBER' | null,
  disabled: boolean,
  now: number,
) {
  const visible = !message.deletedAt &&
    message.visibility !== 'HIDDEN' && message.visibility !== 'UNDER_REVIEW';
  const regular = message.type !== 'SYSTEM' && message.type !== 'PR_EVENT';
  const mine = login !== null && message.sender?.login === login;
  const age = now - Date.parse(message.createdAt);
  const writable = visible && regular && !disabled && login !== null;
  return {
    copy: visible && regular && !!message.text,
    edit: writable && mine && message.type === 'TEXT' &&
      age >= 0 && age < CHAT.editWithinHours * 60 * 60 * 1000,
    delete: writable && (mine || teamRole === 'OWNER' || teamRole === 'ADMIN'),
    report: writable && !mine,
  };
}
