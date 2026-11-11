import { notificationCountOptions, notificationListOptions, notificationTarget } from './notification-queries';

it.each([
  'https://evil.example',
  '//evil.example',
  '/\\evil.example',
  'javascript:alert(1)',
  'relative/path',
])('rejects an unsafe notification destination: %s', (url) =>
  expect(notificationTarget(url)).toBeNull(),
);
it('keeps a valid internal path and its query parameters', () => {
  expect(notificationTarget('/chats/1?source=notification')).toBe('/chats/1?source=notification');
});

it('recovers the bell and both lists in the foreground without relying only on socket frames', () => {
  expect(notificationCountOptions('me').refetchInterval).toBe(30_000);
  expect(notificationListOptions('me').refetchInterval).toBe(30_000);
  expect(notificationListOptions('me', 'unread').refetchInterval).toBe(30_000);
});
