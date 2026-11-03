import { MOCK_ROLE_COOKIE } from '@/lib/auth/mock-viewer';

import { MESSAGES } from './fixtures/chat';
import { withReadState } from './fixtures/chat-reads';
import { resolveIssueCard, validateChatReferences } from './fixtures/chat-references';
import { ISSUES } from './fixtures/issues';
import { TEAM_MEMBERS, TEAMS } from './fixtures/teams';
import { ME } from './fixtures/users';
import { publish, subscribe } from './mock-realtime';
import { mockFetch } from './mock-fetch';

const me = TEAM_MEMBERS[1]!.find((member) => member.user.id === ME.id)!;
const initialRole = me.role;
const repo = TEAMS[0]!.repos[0]!;
const initialPrivate = repo.private;
const originalLength = MESSAGES.length;
beforeEach(() => {
  vi.useFakeTimers();
  document.cookie = `${MOCK_ROLE_COOKIE}=developer; path=/`;
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  me.role = initialRole;
  me.inGithubOrg = true;
  repo.private = initialPrivate;
  MESSAGES.splice(originalLength);
  document.cookie = `${MOCK_ROLE_COOKIE}=; path=/; max-age=0`;
});
it('rejects all-mention payloads and raw text for a member, including a missing all flag', () => {
  me.role = 'MEMBER';
  expect(validateChatReferences(1, ME.id, '@all', {})).toBeNull();
  expect(publish('/app/chat-rooms/1/messages', { text: '@전체 확인', mentionAll: false })).toBe(false);
  me.role = 'ADMIN';
  expect(validateChatReferences(1, ME.id, '@전체', {})).toMatchObject({ mentionAll: true });
});
it('rejects nonmember mention IDs and references outside the room or selected repository', () => {
  expect(validateChatReferences(1, ME.id, '@nobody', { mentionedUserIds: [999999] })).toBeNull();
  expect(validateChatReferences(1, ME.id, '#15', { issueRefs: [{ number: 15, repoId: 21 }] })).toBeNull();
  expect(validateChatReferences(10, ME.id, '#15', { issueRefs: [{ number: 15, repoId: 11 }] })).toBeNull();
});
it('resolves a chosen repository explicitly, even when the issue number exists in two repos', () => {
  const original = ISSUES.find((issue) => issue.teamId === 1 && issue.number === 15)!;
  ISSUES.push({ ...original, id: 9999, repoId: 12, repoName: 'linker-api', title: '다른 저장소 이슈' });
  try {
    expect(resolveIssueCard(1, 15, 11)).toMatchObject({ canView: true, issueId: original.id });
    expect(resolveIssueCard(1, 15, 12)).toMatchObject({ canView: true, issueId: 9999 });
  } finally { ISSUES.pop(); }
});
it('sends references with the retry ID and resolves a card from current issue state', () => {
  const listener = vi.fn();
  const unsubscribe = subscribe('/topic/chat-rooms/1', listener);
  const body = { clientMessageId: 'issue-card-retry', text: '#15', issueRefs: [{ number: 15, repoId: 11 }] };
  try {
    expect(publish('/app/chat-rooms/1/messages', body)).toBe(true);
    expect(publish('/app/chat-rooms/1/messages', body)).toBe(true);
    expect(MESSAGES).toHaveLength(originalLength + 1);
    expect(MESSAGES.at(-1)!.payload).not.toHaveProperty('issueCards');
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ message: expect.objectContaining({ payload: expect.objectContaining({ issueCards: expect.any(Array) }) }) }));
    const issue = ISSUES.find((item) => item.teamId === 1 && item.number === 15)!;
    const status = issue.status;
    try {
      issue.status = 'DONE';
      expect(withReadState(MESSAGES.at(-1)!).payload).toMatchObject({ issueCards: [expect.objectContaining({ status: 'DONE' })] });
    } finally { issue.status = status; }
  } finally { unsubscribe(); }
});
it('redacts private issue details and links when the member lacks GitHub access', () => {
  repo.private = true;
  me.inGithubOrg = false;
  const card = resolveIssueCard(1, 15, 11);
  expect(card).toEqual({ canView: false, title: ISSUES.find((issue) => issue.teamId === 1 && issue.number === 15)!.title });
});
it('requires repoId on the issue-card REST endpoint instead of guessing by number', async () => {
  vi.useRealTimers();
  await expect(mockFetch('/api/v1/user/chat-rooms/1/issue-cards?number=15')).rejects.toMatchObject({ status: 404 });
  await expect(mockFetch('/api/v1/user/chat-rooms/1/issue-cards?number=15&repoId=11')).resolves.toMatchObject({ canView: true, repoId: 11 });
});
