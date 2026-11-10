import { hasEmoji } from './text';

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
