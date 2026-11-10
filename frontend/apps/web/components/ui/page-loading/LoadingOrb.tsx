'use client';

import { ThinkingOrb } from 'thinking-orbs';

import { useLoaderPresence } from './hook';

/** Same black ink as the header mark; ThinkingOrb needs a parsed color string, not a CSS var. */
const ORB_INK = '#000000';

/**
 * The loading mark (Figma 301:294, in place of its three black dots): thinking-orbs "working", 64px.
 * Pinned to the light theme because every loading surface is white. `paused` freezes it on the
 * current frame (load timed out).
 */
export function LoadingOrb({ paused = false }: { paused?: boolean }) {
  return paused ? <Orb paused /> : <ActiveOrb />;
}

/** A running orb counts as "something is loading on screen" */
function ActiveOrb() {
  useLoaderPresence();
  return <Orb paused={false} />;
}

function Orb({ paused }: { paused: boolean }) {
  return (
    <ThinkingOrb state="working" size={64} theme="light" color={ORB_INK} paused={paused} aria-hidden />
  );
}
