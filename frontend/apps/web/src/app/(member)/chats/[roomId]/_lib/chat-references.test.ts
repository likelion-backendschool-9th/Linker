import { activeMention, canMentionAll, issueNumbers, mentionTokens, resolveMentions } from './chat-references';

it('recognizes token boundaries without turning URLs or emails into references', () => {
  const text = 'a@doyun.com https://github.com/a/b#15 @doyun, (#15) #22 #15 #0 #22abc';
  expect(mentionTokens(text)).toEqual(['doyun']);
  expect(issueNumbers(text)).toEqual([15, 22]);
});
it('replaces only the mention at the cursor, preserving following text', () => {
  const text = '안녕 @도 뒷부분';
  expect(activeMention(text, 5)).toEqual({ start: 3, end: 5, search: '도' });
  expect(activeMention('a@name', 6)).toBeNull();
});
it('resolves selected logins to user IDs and separates all mentions', () => {
  expect(resolveMentions('@doyun @unknown @전체 @doyun', [{ id: 2, login: 'doyun', name: '도윤', avatarUrl: '' }])).toEqual({ mentionedUserIds: [2], mentionAll: true });
  expect(canMentionAll('OWNER')).toBe(true);
  expect(canMentionAll('ADMIN')).toBe(true);
  expect(canMentionAll('MEMBER')).toBe(false);
});
