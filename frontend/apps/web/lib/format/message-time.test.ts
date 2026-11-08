import { formatMessageTime } from './time';

it.each([
  ['2026-11-03T06:12:00Z', '오후 3시 12분'],
  ['2026-11-03T03:00:00Z', '오후 12시'],
  ['2026-11-02T15:05:00Z', '오전 12시 5분'],
])('shows a fixed Korean sent time in KST for %s', (value, expected) => {
  expect(formatMessageTime(value)).toBe(expected);
});
