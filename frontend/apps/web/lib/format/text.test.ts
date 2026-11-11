import { hasEmoji, stripEmoji, truncateChars } from './text';

it('cuts at N characters as the policy counts them, never splitting an emoji', () => {
  expect(truncateChars('  짧은 소개  ', 200)).toEqual({ text: '짧은 소개', truncated: false });
  expect(truncateChars('가'.repeat(201), 200)).toEqual({ text: '가'.repeat(200), truncated: true });
  expect(truncateChars('👨‍👩‍👧'.repeat(3), 2)).toEqual({ text: '👨‍👩‍👧'.repeat(2), truncated: true });
  expect(truncateChars('공연 정보 플랫폼', 6)).toEqual({ text: '공연 정보', truncated: true });
});

it('strips emoji so nothing hasEmoji would catch is left', () => {
  expect(stripEmoji('배포 완료 🚀')).toBe('배포 완료 ');
  expect(stripEmoji('가족👨‍👩‍👧 사진')).toBe('가족 사진');
  expect(stripEmoji('🇰🇷 해커톤 1️⃣번')).toBe(' 해커톤 1번');
  expect(stripEmoji('엄지👍🏽')).toBe('엄지');
  for (const value of ['하트 ❤️', '🏴󠁧󠁢󠁥󠁮󠁧󠁿 런던']) expect(hasEmoji(stripEmoji(value))).toBe(false);
  expect(stripEmoji('사이드 프로젝트 (React/Spring) © 2026')).toBe(
    '사이드 프로젝트 (React/Spring) © 2026',
  );
});

it('finds emoji, flags, emoji-style symbols and keycaps', () => {
  expect(hasEmoji('팀원 모집 🚀')).toBe(true);
  expect(hasEmoji('👨‍👩‍👧')).toBe(true);
  expect(hasEmoji('🇰🇷 해커톤')).toBe(true);
  expect(hasEmoji('하트 ❤️')).toBe(true);
  expect(hasEmoji('1️⃣번 역할')).toBe(true);
});

it('leaves plain Korean, English, digits and text symbols alone', () => {
  expect(hasEmoji('사이드 프로젝트 팀원 모집 (React/Spring) 2명')).toBe(false);
  expect(hasEmoji('서울 강남 · 주 2회 ~ 3개월')).toBe(false);
  expect(hasEmoji('Linker© 2026 ↔ 협업')).toBe(false);
});
