import type { TeamItem } from '@linker/api/openAPIDefinition.schemas';
import type { Route } from 'next';

/** Workspace and switcher share the same destination; archived teams expose chat history only. */
export function teamEntryHref(team: Pick<TeamItem, 'id' | 'status' | 'chatRoomId'>): Route | null {
  if (team.status === 'ARCHIVED') {
    return team.chatRoomId === null ? null : (`/chats/${team.chatRoomId}` as Route);
  }
  return `/teams/${team.id}/issues` as Route;
}
