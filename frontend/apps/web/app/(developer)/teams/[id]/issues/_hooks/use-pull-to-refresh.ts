'use client';

import { useEffect, useRef, useState } from 'react';

/** How far the finger moves for each pixel the indicator moves (resistance) */
const RESISTANCE = 0.5;
/** Indicator distance (px) at which letting go refreshes */
export const PULL_THRESHOLD = 64;
/** The indicator never moves further than this (px) */
export const PULL_MAX = 96;

type Options = {
  onRefresh: () => void;
  /** While refreshing or waiting out the once-a-minute limit: the gesture shows but doesn't fire */
  disabled?: boolean;
};

/**
 * Pull to refresh on touch screens (07 TODO 11, 04 ch. 7 "Sync"). Starts only when the page is
 * scrolled to the top and the touch isn't inside an open sheet. The "새로 고침" button stays as the
 * keyboard / screen reader / mouse alternative (WCAG 2.5.7), so the gesture itself is not announced.
 * The WebView app turns its native pull-to-refresh off (blueprint ch. 12), so the web handles it.
 */
export function usePullToRefresh({ onRefresh, disabled = false }: Options) {
  const [distance, setDistance] = useState(0);
  const startY = useRef<number | null>(null);
  const current = useRef(0);
  const latest = useRef({ onRefresh, disabled });
  useEffect(() => {
    latest.current = { onRefresh, disabled };
  });

  useEffect(() => {
    function reset() {
      startY.current = null;
      current.current = 0;
      setDistance(0);
    }

    function onStart(event: TouchEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (event.touches.length !== 1 || window.scrollY > 0 || target?.closest('[role="dialog"]')) {
        startY.current = null;
        return;
      }
      startY.current = event.touches[0]!.clientY;
    }

    function onMove(event: TouchEvent) {
      if (startY.current === null) return;
      const delta = event.touches[0]!.clientY - startY.current;
      // Scrolling up, or the page scrolled meanwhile: not a pull
      if (delta <= 0 || window.scrollY > 0) {
        if (current.current !== 0) reset();
        return;
      }
      current.current = Math.min(delta * RESISTANCE, PULL_MAX);
      setDistance(current.current);
    }

    function onEnd() {
      const pulled = current.current;
      reset();
      if (pulled >= PULL_THRESHOLD && !latest.current.disabled) latest.current.onRefresh();
    }

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', reset);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', reset);
    };
  }, []);

  return { distance, ready: distance >= PULL_THRESHOLD };
}
