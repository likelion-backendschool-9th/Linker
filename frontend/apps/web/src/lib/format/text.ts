import { INPUT } from '@/lib/policy';

const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });

/** Characters as the policy counts them: trimmed, every Korean/English/digit/emoji = 1 (04 ch. 2). */
export function countChars(value: string): number {
  return Array.from(segmenter.segment(value.trim())).length;
}

/** Keeps at most two consecutive line breaks (04 ch. 2). Apply before saving. */
export function normalizeLineBreaks(value: string): string {
  const max = INPUT.maxConsecutiveLineBreaks;
  return value
    .replace(/\r\n?/g, '\n')
    .replace(new RegExp(`\n{${max + 1},}`, 'g'), '\n'.repeat(max));
}
