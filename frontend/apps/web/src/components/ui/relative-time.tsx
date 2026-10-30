'use client';

import { useIsClient } from '@/hooks/use-is-client';
import { formatDate, formatRelativeTime, toKstIso } from '@/lib/format/time';

/** Absolute date on the server, relative after mount, so hydration never mismatches (blueprint §11-1). */
export function RelativeTime({ value }: { value: string }) {
  const isClient = useIsClient();
  return (
    <time dateTime={toKstIso(value)}>
      {isClient ? formatRelativeTime(value) : formatDate(value)}
    </time>
  );
}
