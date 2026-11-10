'use client';

import { ArrowLeft } from 'lucide-react';
import type { Route } from 'next';

import { useAppBack } from '@/lib/navigation/use-app-back';

import styles from '../header.module.css';

/** Top-bar back (Figma lucide arrow-left): never leaves Linker for a shared-link visitor (blueprint §7-5). */
export function BackButton({ fallbackHref }: { fallbackHref: Route }) {
  const back = useAppBack(fallbackHref);
  return (
    <button type="button" className={styles.iconButton} onClick={back}>
      <ArrowLeft aria-hidden className={styles.backIcon} />
      <span className="sr-only">뒤로</span>
    </button>
  );
}
