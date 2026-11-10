'use client';

import type { ReactNode } from 'react';

import styles from '../header.module.css';
import { useMobileSearch } from '../mobile-search-context';

/**
 * Sticky frosted background shared by the header row and the search panel below it. Figma
 * (51:274) merges both into one lighter-blur plate when the panel is open, rather than stacking
 * two separately blurred backgrounds.
 */
export function HeaderChrome({ children }: { children: ReactNode }) {
  const { isOpen } = useMobileSearch();
  return (
    <div className={`${styles.chrome} ${isOpen ? styles.chromeOpen : ''}`}>{children}</div>
  );
}
