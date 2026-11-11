import type { ReactNode } from 'react';

import styles from '../header.module.css';

/** Sticky frosted background behind the tab header row. */
export function HeaderChrome({ children }: { children: ReactNode }) {
  return <div className={styles.chrome}>{children}</div>;
}
