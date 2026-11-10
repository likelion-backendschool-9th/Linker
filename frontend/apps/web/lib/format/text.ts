import { INPUT } from '@/lib/policy';

const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });

/** Characters as the policy counts them: trimmed, every Korean/English/digit/emoji = 1 (04 ch. 2). */
export function countChars(value: string): number {
  return Array.from(segmenter.segment(value.trim())).length;
}

/**
 * Emoji (POL-R-1 recruit post text takes none): pictures by default, flag letters, and the
 * emoji-style / keycap marks. The backend's `RecruitmentService.isEmojiCodePoint` matches the same set.
 */
const EMOJI = /[\p{Emoji_Presentation}\p{Regional_Indicator}\uFE0F\u20E3]/u;

export function hasEmoji(value: string): boolean {
  return EMOJI.test(value);
}

/** Keeps at most two consecutive line breaks (04 ch. 2). Apply before saving. */
export function normalizeLineBreaks(value: string): string {
  const max = INPUT.maxConsecutiveLineBreaks;
  return value
    .replace(/\r\n?/g, '\n')
    .replace(new RegExp(`\n{${max + 1},}`, 'g'), '\n'.repeat(max));
}
