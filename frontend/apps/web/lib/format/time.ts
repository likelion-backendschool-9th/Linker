import { TZDate } from '@date-fns/tz';
import { differenceInMinutes, format } from 'date-fns';

/** Servers run UTC; every date, "today" and calendar goes through KST (blueprint §11-1). */
export const KST = 'Asia/Seoul';

export function toKst(value: Date | string | number): TZDate {
  return new TZDate(new Date(value).getTime(), KST);
}

/** Value for `<time dateTime>`: ISO with the +09:00 offset. */
export function toKstIso(value: Date | string | number): string {
  return format(toKst(value), "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/** "10월 16일" this year, "2025. 10. 16." for earlier years (04 ch. 2 "Time display"). */
export function formatDate(value: Date | string | number, now: Date = new Date()): string {
  const date = toKst(value);
  if (date.getFullYear() === toKst(now).getFullYear()) return format(date, 'M월 d일');
  return format(date, 'yyyy. M. d.');
}

/** "방금" / "N분 전" / "N시간 전" under 24 hours, otherwise `formatDate` (04 ch. 2). */
export function formatRelativeTime(value: Date | string | number, now: Date = new Date()): string {
  const minutes = differenceInMinutes(now, new Date(value));
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}시간 전`;
  return formatDate(value, now);
}

/** "2026년 12월 3일" with the year always shown (29 subscription dates and payment history, Figma 294:306). */
export function formatFullDate(value: Date | string | number): string {
  return format(toKst(value), 'yyyy년 M월 d일');
}

/** "2026.11.16 마감" (19 recruit card, Figma 254:2298) — plain KST date, no leading zero on month/day. */
export function formatDeadlineDate(date: string): string {
  return `${format(toKst(date), 'yyyy.M.d')} 마감`;
}

/** Today's date in KST as `yyyy-MM-dd`, the format of issue start/due dates (POL-I-4: team timezone is KST). */
export function todayKst(now: Date = new Date()): string {
  return format(toKst(now), 'yyyy-MM-dd');
}

/** Calendar days from today (KST) to a `yyyy-MM-dd` date; 0 = today, negative = past (recruit D-day). */
export function daysUntil(date: string, now: Date = new Date()): number {
  return Math.round((Date.parse(date) - Date.parse(todayKst(now))) / (24 * 60 * 60 * 1000));
}

/** Fixed chat sent time, e.g. "오후 3:12". Date dividers supply the calendar date. */
export function formatMessageTime(value: Date | string | number): string {
  const date = toKst(value);
  return `${date.getHours() < 12 ? '오전' : '오후'} ${format(date, 'h:mm')}`;
}
