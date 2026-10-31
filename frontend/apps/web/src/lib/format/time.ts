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

/** Today's date in KST as `yyyy-MM-dd`, the format of issue start/due dates (POL-I-4: team timezone is KST). */
export function todayKst(now: Date = new Date()): string {
  return format(toKst(now), 'yyyy-MM-dd');
}
