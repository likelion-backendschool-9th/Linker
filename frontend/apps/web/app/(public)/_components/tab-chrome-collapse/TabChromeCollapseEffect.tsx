'use client';

import { useTabChromeCollapse } from './hook';

/** Isolates the scroll-top latch side effect so the page component around it stays simple (19, 24). */
export function TabChromeCollapseEffect() {
  useTabChromeCollapse();
  return null;
}
