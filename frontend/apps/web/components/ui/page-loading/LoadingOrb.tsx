'use client';

import { ThinkingOrb } from 'thinking-orbs';

import { useLoaderPresence } from './hook';
import styles from './PageLoading.module.css';

/** Same black ink as the header mark; ThinkingOrb needs a parsed color string, not a CSS var. */
const ORB_INK = '#000000';

const ORB_COUNT = 3;

/**
 * The loading mark (Figma 301:294): one thinking-orbs "working" orb (64px) on each of its three black
 * dots, side by side 20 apart like the dots. Pinned to the light theme because every loading surface
 * is white. `paused` freezes them on the current frame (load timed out).
 */
export function LoadingOrb({ paused = false }: { paused?: boolean }) {
  return paused ? <OrbRow paused /> : <ActiveOrbRow />;
}

/** Running orbs count as "something is loading on screen" */
function ActiveOrbRow() {
  useLoaderPresence();
  return <OrbRow paused={false} />;
}

function OrbRow({ paused }: { paused: boolean }) {
  return (
    <span className={styles.orbs} aria-hidden>
      {Array.from({ length: ORB_COUNT }, (_, index) => (
        <ThinkingOrb
          key={index}
          state="working"
          size={64}
          theme="light"
          color={ORB_INK}
          paused={paused}
        />
      ))}
    </span>
  );
}
