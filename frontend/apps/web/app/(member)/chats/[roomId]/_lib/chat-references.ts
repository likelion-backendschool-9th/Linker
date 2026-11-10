import type { MentionCandidate } from './chat-reference-api';

/** Whitespace/opening brackets delimit tokens; URLs and email addresses are not references. */
const mentions = /(?:^|[\s(])@([\p{L}\p{N}_-]+)(?=$|[^\p{L}\p{N}_-])/gu;
export function mentionTokens(text: string) {
  return [...new Set([...text.matchAll(mentions)].map((match) => match[1]!))];
}
export function issueNumbers(text: string) {
  return [...new Set([...text.matchAll(/(?:^|[\s(])#([1-9]\d*)(?=$|[^\p{L}\p{N}_-])/gu)]
    .map((match) => Number(match[1])).filter(Number.isSafeInteger))];
}
export function activeMention(text: string, caret: number) {
  const match = /(?:^|[\s(])@([\p{L}\p{N}_-]*)$/u.exec(text.slice(0, caret));
  return match ? { start: caret - match[1]!.length - 1, end: caret, search: match[1]! } : null;
}
export function resolveMentions(text: string, candidates: MentionCandidate[]) {
  const tokens = mentionTokens(text);
  return {
    mentionedUserIds: candidates.filter((member) => tokens.includes(member.login)).map((member) => member.id),
    mentionAll: tokens.includes('전체') || tokens.includes('all'),
  };
}
export function canMentionAll(role: 'OWNER' | 'ADMIN' | 'MEMBER' | undefined) {
  return role === 'OWNER' || role === 'ADMIN';
}
