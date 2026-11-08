'use client';

import { ThinkingOrb } from 'thinking-orbs';

/** Pure black for header mark contrast — ThinkingOrb needs a parsed color string, not a CSS var. */
const ORB_INK = '#000000';

/**
 * Animated mark for the tab header brand link. Canvas-only, pauses offscreen /
 * when the tab is hidden, and respects prefers-reduced-motion.
 */
export function HeaderLogoOrb() {
  return (
    <ThinkingOrb
      state="connecting"
      size={32}
      theme="light"
      color={ORB_INK}
      speed={0.55}
      dots={1.5}
      opts={{ lineW: 4.4, thr: 1, signals: 8 }}
      aria-hidden
    />
  );
}
