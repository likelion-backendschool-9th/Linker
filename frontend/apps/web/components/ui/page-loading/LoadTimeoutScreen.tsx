'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { useAppSignalStore } from '@/stores/app-signal-store';

import { PageLoadTimeout } from './PageLoadTimeout';

/**
 * Mounted once in providers. A screen whose data timed out before anything was shown (signal raised by
 * the shared query error handler, blueprint §5-5) gets the timeout screen; it clears on navigation.
 */
export function LoadTimeoutScreen() {
  const timedOutAt = useAppSignalStore((state) => state.loadTimedOutAt);
  const pathname = usePathname();
  const shownOn = useRef<string | null>(null);

  useEffect(() => {
    if (timedOutAt === 0) return;
    if (shownOn.current === null) shownOn.current = pathname;
    else if (shownOn.current !== pathname) {
      shownOn.current = null;
      useAppSignalStore.setState({ loadTimedOutAt: 0 });
    }
  }, [timedOutAt, pathname]);

  if (timedOutAt === 0) return null;
  return <PageLoadTimeout onBack={() => useAppSignalStore.setState({ loadTimedOutAt: 0 })} />;
}
