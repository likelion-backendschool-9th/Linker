'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { handlePathChange, handlePopState, initNavDepth } from '@/lib/navigation/nav-depth';
import { resetOverlayHistory, useActiveOverlay } from '@/lib/navigation/use-overlay';

/**
 * Keeps overlay and back bookkeeping in sync with the URL (blueprint §7-3, §7-5). Mounted once in providers.
 * - URL lost its overlay (browser, Android or bridge back) → forget that we pushed it.
 * - Tracks in-app depth for `useAppBack`.
 */
export function OverlayRoot() {
  const { overlay } = useActiveOverlay();
  const pathname = usePathname();

  useEffect(() => {
    if (overlay === null) resetOverlayHistory();
  }, [overlay]);

  useEffect(() => {
    initNavDepth(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    handlePathChange(pathname);
  }, [pathname]);

  return null;
}
