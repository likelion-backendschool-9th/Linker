import type { ChatIssueCard, ChatReferences, IssueReference } from '@/app/(member)/chats/[roomId]/_lib/chat-reference-types';
import { canMentionAll, issueNumbers, resolveMentions } from '@/app/(member)/chats/[roomId]/_lib/chat-references';

import { findRoom, type MockMessage } from './chat';
import { ISSUES } from './issues';
import { findTeam, TEAM_MEMBERS } from './teams';
import { ME } from './users';

export function resolveIssueCard(roomId: number, number: number, repoId: number, userId = ME.id): ChatIssueCard | null {
  const room = findRoom(roomId);
  const team = room?.teamId ? findTeam(room.teamId) : null;
  const repo = team?.repos.find((item) => item.id === repoId);
  const issue = ISSUES.find((item) => item.teamId === team?.id && item.repoId === repoId && item.number === number);
  if (!repo || !issue || !team) return null;
  const member = (TEAM_MEMBERS[team.id] ?? []).find((item) => item.user.id === userId);
  if (!member) return null;
  if (repo.private && !member.inGithubOrg) return { canView: false, title: issue.title };
  return { canView: true, issueId: issue.id, teamId: issue.teamId, number: issue.number, repoId, repoName: repo.name, title: issue.title, status: issue.status };
}

/** Re-resolve original issue rows on every history/preview read, rather than storing titles/statuses. */
export function withChatReferences(message: MockMessage) {
  const refs = message.payload?.issueRefs as IssueReference[] | undefined;
  if (!refs?.length) return message.payload;
  return { ...message.payload, issueCards: refs.map((ref) => resolveIssueCard(message.roomId, ref.number, ref.repoId) ?? { canView: false as const, title: '볼 수 없는 이슈예요.' }) };
}

export function validateChatReferences(roomId: number, userId: number, text: string, payload: Partial<ChatReferences>): ChatReferences | null {
  const room = findRoom(roomId);
  const team = room?.teamId ? findTeam(room.teamId) : null;
  const ids = payload.mentionedUserIds ?? [];
  const refs = payload.issueRefs ?? [];
  if (!Array.isArray(ids) || !Array.isArray(refs)) return null;
  if (!team) return ids.length || refs.length || payload.mentionAll ? null : { mentionedUserIds: [], mentionAll: false, issueRefs: [] };
  const candidates = (TEAM_MEMBERS[team.id] ?? []).map((member) => member.user);
  const author = (TEAM_MEMBERS[team.id] ?? []).find((member) => member.user.id === userId);
  if (!author) return null;
  const mentions = resolveMentions(text, candidates);
  if ((mentions.mentionAll || payload.mentionAll) && !canMentionAll(author.role)) return null;
  if (ids.some((id) => !mentions.mentionedUserIds.includes(id))) return null;
  const numbers = issueNumbers(text);
  if (refs.some((ref) => !ref || !numbers.includes(ref.number) || !resolveIssueCard(roomId, ref.number, ref.repoId, userId))) return null;
  return { ...mentions, issueRefs: refs };
}
