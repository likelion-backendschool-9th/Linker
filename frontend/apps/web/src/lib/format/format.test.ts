import { formatCount } from './number';
import { countChars, normalizeLineBreaks } from './text';
import { daysUntil, formatDate, formatRelativeTime, toKstIso } from './time';

const now = new Date('2026-10-31T03:00:00Z'); // 12:00 KST

describe('formatRelativeTime', () => {
  it.each([
    ['2026-10-31T02:59:30Z', '방금'],
    ['2026-10-31T02:15:00Z', '45분 전'],
    ['2026-10-30T05:00:00Z', '22시간 전'],
    ['2026-10-16T03:00:00Z', '10월 16일'],
    ['2025-10-16T03:00:00Z', '2025. 10. 16.'],
  ])('%s → %s', (value, expected) => {
    expect(formatRelativeTime(value, now)).toBe(expected);
  });
});

describe('formatDate', () => {
  it('uses the KST calendar day, not UTC', () => {
    // 2025-12-31 16:00 UTC is already 2026-01-01 in KST
    expect(formatDate('2025-12-31T16:00:00Z', now)).toBe('1월 1일');
  });
});

describe('toKstIso', () => {
  it('writes the +09:00 offset', () => {
    expect(toKstIso('2026-10-31T03:00:00Z')).toBe('2026-10-31T12:00:00+09:00');
  });
});

describe('daysUntil', () => {
  it('counts KST calendar days to a date', () => {
    expect(daysUntil('2026-10-31', now)).toBe(0);
    expect(daysUntil('2026-11-05', now)).toBe(5);
    expect(daysUntil('2026-10-30', now)).toBe(-1);
    // 2026-10-31 15:30 UTC is already 2026-11-01 in KST
    expect(daysUntil('2026-11-01', new Date('2026-10-31T15:30:00Z'))).toBe(0);
  });
});

describe('formatCount', () => {
  it.each([
    [999, '999'],
    [1000, '1천'],
    [1250, '1.2천'],
    [9999, '9.9천'],
    [10000, '1만'],
    [12345, '1.2만'],
  ])('%d → %s', (value, expected) => {
    expect(formatCount(value)).toBe(expected);
  });
});

describe('countChars', () => {
  it('trims and counts emoji and Korean as one each', () => {
    expect(countChars('  안녕 👋🏻  ')).toBe(4);
  });
});

describe('normalizeLineBreaks', () => {
  it('keeps at most two consecutive line breaks', () => {
    expect(normalizeLineBreaks('a\n\n\n\nb\r\nc')).toBe('a\n\nb\nc');
  });
});
