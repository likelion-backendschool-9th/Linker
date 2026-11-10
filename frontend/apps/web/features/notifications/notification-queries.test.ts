import { notificationTarget } from './notification-queries';

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
