import { CHAT } from '@/lib/policy';

import { messageActions } from './message-actions';
import type { RoomMessage } from './room-api';

const now = Date.parse('2026-11-03T03:00:00Z');
const message: RoomMessage = {
  id: 1, roomId: 1, sender: { id: 1, login: 'me', name: '나', avatarUrl: '' },
  type: 'TEXT', text: '메시지', imageUrls: [], payload: null,
  createdAt: new Date(now - 1000).toISOString(), editedAt: null, deletedAt: null,
};
it('allows author edits before the deadline, but only deletion after the deadline', () => {
  expect(messageActions(message, 'me', null, false, now)).toEqual({ copy: true, edit: true, delete: true, report: false });
  const deadline = Date.parse(message.createdAt) + CHAT.editWithinHours * 60 * 60 * 1000;
  expect(messageActions(message, 'me', null, false, deadline).edit).toBe(false);
  expect(messageActions(message, 'me', null, false, deadline).delete).toBe(true);
});
it('allows team admins to delete others, but never edit them', () => {
  expect(messageActions(message, 'other', 'ADMIN', false, now)).toEqual({ copy: true, edit: false, delete: true, report: true });
  expect(messageActions(message, 'other', 'MEMBER', false, now).delete).toBe(false);
});
it.each(['SYSTEM', 'PR_EVENT'] as const)('protects %s messages even from team owners', (type) => {
  expect(Object.values(messageActions({ ...message, type }, 'me', 'OWNER', false, now))).not.toContain(true);
});
it.each([{ deletedAt: new Date(now).toISOString() }, { visibility: 'HIDDEN' as const }, { visibility: 'UNDER_REVIEW' as const }])('does not expose hidden or deleted content', (state) => {
  expect(Object.values(messageActions({ ...message, ...state }, 'me', 'OWNER', false, now))).not.toContain(true);
});
it('keeps read-only and suspended viewers from mutating or reporting', () => {
  expect(messageActions(message, 'me', 'OWNER', true, now)).toEqual({ copy: true, edit: false, delete: false, report: false });
});
