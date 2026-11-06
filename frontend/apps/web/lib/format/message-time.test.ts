import { formatMessageTime } from './time';

it.each([
  ['2026-11-03T06:12:00Z', '오후 3:12'],
  ['2026-11-03T03:00:00Z', '오후 12:00'],
  ['2026-11-02T15:05:00Z', '오전 12:05'],
])('shows a fixed Korean sent time in KST for %s', (value, expected) => {
  expect(formatMessageTime(value)).toBe(expected);
});
